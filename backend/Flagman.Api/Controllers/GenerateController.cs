using System.Security.Claims;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager")]
public class GenerateController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly Random _rnd = new();

    public GenerateController(AppDbContext db) => _db = db;

    // POST /api/generate?deliveries=5&orders=8&reset=true
    // Наполняет базу правдоподобными данными для проверки и репетиций
    [HttpPost("api/generate")]
    public async Task<ActionResult> Generate(
        [FromQuery] int deliveries = 5,
        [FromQuery] int orders = 8,
        [FromQuery] bool reset = false)
    {
        var userId = GetUserId();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // 1. Очистка склада и заказов. Пользователи, продукты и блюда остаются
        if (reset)
        {
            _db.StockMovements.RemoveRange(_db.StockMovements);
            _db.ProductBatches.RemoveRange(_db.ProductBatches);
            _db.OrderItems.RemoveRange(_db.OrderItems);
            _db.Orders.RemoveRange(_db.Orders);
            _db.Deliveries.RemoveRange(_db.Deliveries);
            await _db.SaveChangesAsync();
        }

        // 2. Базовый набор, если справочники пустые
        if (!await _db.Products.AnyAsync())
        {
            _db.Products.AddRange(
                new Product { Name = "Курица", Unit = "кг", MinStock = 2, ShelfLifeDays = 3 },
                new Product { Name = "Помидор", Unit = "кг", MinStock = 5, ShelfLifeDays = 7 },
                new Product { Name = "Масло", Unit = "л", MinStock = 1, ShelfLifeDays = 30 });
            await _db.SaveChangesAsync();
        }

        if (!await _db.Dishes.AnyAsync())
        {
            var chicken = await _db.Products.FirstAsync(p => p.Name == "Курица");
            var tomato = await _db.Products.FirstAsync(p => p.Name == "Помидор");

            var salad = new Dish { Name = "Цезарь" };
            var soup = new Dish { Name = "Куриный суп" };
            _db.Dishes.AddRange(salad, soup);
            await _db.SaveChangesAsync();

            _db.RecipeItems.AddRange(
                new RecipeItem { DishId = salad.Id, ProductId = chicken.Id, QuantityPerPortion = 0.20m },
                new RecipeItem { DishId = salad.Id, ProductId = tomato.Id, QuantityPerPortion = 0.10m },
                new RecipeItem { DishId = soup.Id, ProductId = chicken.Id, QuantityPerPortion = 0.10m });
            await _db.SaveChangesAsync();
        }

        var products = await _db.Products.Where(p => !p.IsArchived).ToListAsync();
        var dishes = await _db.Dishes.ToListAsync();

        // 3. Поставки: случайные продукты, количества и сроки
        var batchesCreated = 0;

        for (var i = 1; i <= deliveries; i++)
        {
            var delivery = new Delivery
            {
                Number = $"Г-{DateTime.UtcNow:ddMM}-{i:00}",
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                Comment = "Сгенерировано автоматически"
            };
            _db.Deliveries.Add(delivery);
            await _db.SaveChangesAsync();

            // В поставке — от одного до трёх случайных продуктов
            var inDelivery = products.OrderBy(_ => _rnd.Next()).Take(_rnd.Next(1, 4)).ToList();

            foreach (var product in inDelivery)
            {
                // Срок: иногда просроченный, иногда «на грани», обычно — обычный
                var shift = _rnd.Next(0, 10) switch
                {
                    <= 1 => -2,
                    <= 3 => 1,
                    _ => product.ShelfLifeDays
                };

                var quantity = Math.Round((decimal)(_rnd.NextDouble() * 8 + 1), 2);

                var batch = new ProductBatch
                {
                    ProductId = product.Id,
                    Quantity = quantity,
                    ExpiryDate = today.AddDays(shift),
                    ReceivedAt = DateTime.UtcNow,
                    DeliveryId = delivery.Id
                };
                _db.ProductBatches.Add(batch);
                await _db.SaveChangesAsync();

                _db.StockMovements.Add(new StockMovement
                {
                    ProductId = product.Id,
                    BatchId = batch.Id,
                    QuantityDelta = quantity,
                    Type = MovementType.Receipt,
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();

                batchesCreated++;
            }
        }

        // 4. Заказы: случайные блюда. Если не хватает продуктов — заказ пропускаем
        var ordersCreated = 0;
        var ordersSkipped = 0;

        for (var i = 0; i < orders; i++)
        {
            var chosen = dishes.OrderBy(_ => _rnd.Next()).Take(_rnd.Next(1, 3)).ToList();
            var items = chosen
                .Select(d => new OrderItem { DishId = d.Id, Quantity = _rnd.Next(1, 6) })
                .ToList();

            // Сколько каких продуктов понадобится
            var needed = new Dictionary<int, decimal>();
            foreach (var item in items)
            {
                var recipe = await _db.RecipeItems
                    .Where(r => r.DishId == item.DishId)
                    .ToListAsync();

                foreach (var r in recipe)
                    needed[r.ProductId] = needed.GetValueOrDefault(r.ProductId)
                                          + r.QuantityPerPortion * item.Quantity;
            }

            // Хватает ли
            var enough = true;
            foreach (var (productId, required) in needed)
            {
                var available = await _db.ProductBatches
                    .Where(b => b.ProductId == productId && b.Quantity > 0 && b.ExpiryDate >= today)
                    .SumAsync(b => (decimal?)b.Quantity) ?? 0;

                if (available < required) { enough = false; break; }
            }

            if (!enough) { ordersSkipped++; continue; }

            await using var tx = await _db.Database.BeginTransactionAsync();

            var order = new Order { CreatedByUserId = userId, CreatedAt = DateTime.UtcNow };
            _db.Orders.Add(order);
            await _db.SaveChangesAsync();

            foreach (var item in items)
            {
                item.OrderId = order.Id;
                _db.OrderItems.Add(item);
            }
            await _db.SaveChangesAsync();

            foreach (var (productId, required) in needed)
                await FefoWriter.WriteOffForOrder(_db, productId, required, order.Id, userId);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            ordersCreated++;
        }

        return Ok(new
        {
            batches = batchesCreated,
            orders = ordersCreated,
            skippedOrders = ordersSkipped,
            message = $"Создано партий: {batchesCreated}, заказов: {ordersCreated}"
                      + (ordersSkipped > 0 ? $", пропущено из-за нехватки продуктов: {ordersSkipped}" : "")
        });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}