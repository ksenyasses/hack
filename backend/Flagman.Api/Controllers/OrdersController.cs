using System.Security.Claims;
using System.Globalization;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;

    public OrdersController(AppDbContext db) => _db = db;

    public record OrderItemRequest(int DishId, int Quantity);
    public record OrderRequest(List<OrderItemRequest> Items,
                               string? TableNumber = null,
                               ServeMode ServeMode = ServeMode.AllAtOnce);

    // POST /api/orders — заказ из нескольких блюд
    [HttpPost]
    [Authorize(Roles = "Waiter,Manager")]
    public async Task<ActionResult> Create(OrderRequest request)
    {
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { error = "Заказ пустой" });

        var today = StockHelper.Today();
        var userId = GetUserId();
        var ci = CultureInfo.GetCultureInfo("ru-RU");
        var orderItems = new List<OrderItem>();
        var needed = new Dictionary<int, decimal>();

        // 1. Разбираем блюда и считаем, сколько каких продуктов понадобится
        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0)
                return BadRequest(new { error = "Количество порций должно быть больше нуля" });

            var dish = await _db.Dishes.FindAsync(item.DishId);
            if (dish is null)
                return BadRequest(new { error = $"Блюдо с id {item.DishId} не найдено" });
            if (dish.IsManuallyStopped)
                return BadRequest(new { error = $"Блюдо «{dish.Name}» снято с продажи вручную" });

            var recipe = await _db.RecipeItems
                .Where(r => r.DishId == dish.Id)
                .Select(r => new { r.ProductId, r.QuantityPerPortion })
                .ToListAsync();

            if (recipe.Count == 0)
                return BadRequest(new { error = $"У блюда «{dish.Name}» не задан рецепт" });

            foreach (var r in recipe)
                needed[r.ProductId] = needed.GetValueOrDefault(r.ProductId)
                                      + r.QuantityPerPortion * item.Quantity;

            orderItems.Add(new OrderItem { DishId = dish.Id, Quantity = item.Quantity });
        }

        // 2. Проверяем наличие ДО любых изменений — чтобы отказать понятно
        foreach (var (productId, required) in needed)
        {
            var available = await _db.ProductBatches
                .Where(b => b.ProductId == productId && b.Quantity > 0 && b.ExpiryDate >= today)
                .SumAsync(b => (decimal?)b.Quantity) ?? 0;

            if (available < required)
            {
                var product = await _db.Products.FindAsync(productId);
                return BadRequest(new
                {
                    error = $"Недостаточно «{product?.Name}»: нужно {required.ToString("0.00", ci)} {product?.Unit}, доступно {available.ToString("0.00", ci)} {product?.Unit}"
                });
            }
        }

        // 3. Пишем всё одной транзакцией: заказ, строки, списания
        await using var tx = await _db.Database.BeginTransactionAsync();

        var order = new Order
        {
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            TableNumber = request.TableNumber,
            ServeMode = request.ServeMode
        };
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        foreach (var item in orderItems)
        {
            item.OrderId = order.Id;
            _db.OrderItems.Add(item);
        }
        await _db.SaveChangesAsync();

        try
        {
            foreach (var (productId, required) in needed)
                await FefoWriter.WriteOffForOrder(_db, productId, required, order.Id, userId);

            await _db.SaveChangesAsync();
        }
        catch (NotEnoughStockException ex)
        {
            await tx.RollbackAsync();
            return BadRequest(new { error = ex.Message });
        }

        await tx.CommitAsync();

        return Ok(new
        {
            order.Id,
            order.CreatedAt,
            order.TableNumber,
            serveMode = order.ServeMode.ToString(),
            status = order.Status.ToString(),
            items = orderItems.Select(i => new
            {
                i.DishId,
                i.Quantity,
                status = i.Status.ToString()
            })
        });
    }

    // GET /api/orders — заказы с составом: что ушло и из какой партии
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        // Рабочий список: только новые заказы. Выданные уходят в архив,
        // отменённые — в пустоту. Поэтому ни на кухне, ни у официанта
        // отработанного заказа не видно.
        var orders = await _db.Orders
            .Where(o => o.Status == OrderStatus.New)
            .OrderByDescending(o => o.Id)
            .ToListAsync();
        var result = new List<object>();

        foreach (var order in orders)
        {
            var items = await _db.OrderItems
                .Where(i => i.OrderId == order.Id)
                .Select(i => new
                {
                    i.DishId,
                    dishName = _db.Dishes.Where(d => d.Id == i.DishId).Select(d => d.Name).FirstOrDefault(),
                    i.Quantity,
                    status = i.Status.ToString()
                })
                .ToListAsync();

            // Движения по заказу — со сроком партии и номером поставки
            var movements = await _db.StockMovements
                .Where(m => m.OrderId == order.Id)
                .Select(m => new
                {
                    m.ProductId,
                    productName = _db.Products.Where(p => p.Id == m.ProductId).Select(p => p.Name).FirstOrDefault(),
                    m.BatchId,
                    deliveryNumber = _db.ProductBatches
                        .Where(b => b.Id == m.BatchId)
                        .Select(b => _db.Deliveries.Where(d => d.Id == b.DeliveryId)
                            .Select(d => d.Number).FirstOrDefault())
                        .FirstOrDefault(),
                    batchExpiry = _db.ProductBatches
                        .Where(b => b.Id == m.BatchId)
                        .Select(b => (DateOnly?)b.ExpiryDate).FirstOrDefault(),
                    m.QuantityDelta
                })
                .ToListAsync();

            // У каждой позиции — свои партии. Один продукт мог уйти из нескольких,
            // поэтому группируем движения по паре «продукт + партия»
            var recipeProducts = await _db.RecipeItems
                .Select(r => r.DishId)
                .Distinct()
                .ToListAsync();
            _ = recipeProducts;

            var perDish = new List<object>();

            foreach (var i in items)
            {
                var recipe = await _db.RecipeItems
                    .Where(r => r.DishId == i.DishId)
                    .Select(r => r.ProductId)
                    .ToListAsync();

                var batches = (from prodId in recipe
                               join mv in movements on prodId equals mv.ProductId
                               group mv by new { mv.ProductId, mv.BatchId } into g
                               select new
                               {
                                   productId = g.Key.ProductId,
                                   productName = g.First().productName,
                                   quantity = Math.Abs(g.Sum(x => x.QuantityDelta)),
                                   deliveryNumber = g.First().deliveryNumber,
                                   batchExpiry = g.First().batchExpiry
                               }).ToList();

                perDish.Add(new
                {
                    i.DishId,
                    i.dishName,
                    i.Quantity,
                    i.status,
                    batches
                });
            }

            result.Add(new
            {
                order.Id,
                order.CreatedAt,
                order.TableNumber,
                serveMode = order.ServeMode.ToString(),
                status = order.Status.ToString(),
                items = perDish,
                movements
            });
        }

        return Ok(result);
    }

    // PUT /api/orders/{orderId}/items/{dishId}/ready — повар отметил блюдо готовым
    [HttpPut("{orderId}/items/{dishId}/ready")]
    [Authorize(Roles = "Cook,Manager")]
    public async Task<ActionResult> MarkItemReady(int orderId, int dishId)
    {
        var order = await _db.Orders.FindAsync(orderId);
        if (order is null)
            return NotFound(new { error = "Заказ не найден" });
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest(new { error = "Заказ отменён" });

        // Ищем позицию по блюду, а не по id строки: фронт знает только dishId
        var item = await _db.OrderItems
            .FirstOrDefaultAsync(i => i.OrderId == orderId && i.DishId == dishId);
        if (item is null)
            return NotFound(new { error = "Блюдо в этом заказе не найдено" });

        item.Status = OrderItemStatus.Ready;
        // Запоминаем, кто именно приготовил — это попадёт в архив заказов
        item.ReadyByUserId = GetUserId();
        await _db.SaveChangesAsync();

        return Ok(new { item.Id, item.DishId, status = item.Status.ToString() });
    }

    // POST /api/orders/{id}/served — официант выдал гостю.
    // Заказ уходит из рабочего списка и появляется в архиве.
    [HttpPost("{id}/served")]
    [Authorize(Roles = "Waiter,Manager")]
    public async Task<ActionResult> MarkServed(int id)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order is null)
            return NotFound(new { error = "Заказ не найден" });
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest(new { error = "Заказ отменён" });
        if (order.Status == OrderStatus.Served)
            return BadRequest(new { error = "Заказ уже выдан" });

        var items = await _db.OrderItems.Where(i => i.OrderId == id).ToListAsync();
        if (items.Any(i => i.Status != OrderItemStatus.Ready))
            return BadRequest(new { error = "Не все блюда готовы — выдать пока нечего" });

        order.Status = OrderStatus.Served;
        order.ServedAt = DateTime.UtcNow;
        order.ServedByUserId = GetUserId();
        await _db.SaveChangesAsync();

        return Ok(new
        {
            order.Id,
            status = order.Status.ToString(),
            servedAt = order.ServedAt,
            servedBy = GetUserId()
        });
    }

    // GET /api/orders/archive — архив выданных заказов.
    // Фильтры такие же, как в журнале: период, стол, сотрудник.
    [HttpGet("archive")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Archive(
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery] string? table = null,
        [FromQuery] string? user = null)
    {
        var query = _db.Orders.Where(o => o.Status == OrderStatus.Served);

        // Даты фильтра считаем местным временем сервера и переводим в UTC
        if (from.HasValue)
        {
            var fromDate = DateTime.SpecifyKind(
                from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();
            query = query.Where(o => o.ServedAt >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = DateTime.SpecifyKind(
                to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();
            query = query.Where(o => o.ServedAt < toDate);
        }

        // По столу — подстрока, чтобы находило «5» по «стол 5» и «5, VIP-2»
        if (!string.IsNullOrWhiteSpace(table))
        {
            var t = table.Trim().ToLower();
            query = query.Where(o => o.TableNumber != null && o.TableNumber.ToLower().Contains(t));
        }

        var rows = await query.OrderByDescending(o => o.ServedAt).ToListAsync();

        // Логины сотрудников: показываем именно логин (cook, waiter),
        // как и просили, а не полное имя из справочника
        var users = await _db.Users
            .Select(u => new { u.Id, u.Login, u.FullName, u.Role })
            .ToDictionaryAsync(u => u.Id);

        var itemRows = await _db.OrderItems
            .Where(i => rows.Select(o => o.Id).Contains(i.OrderId))
            .Select(i => new { i.OrderId, i.DishId, i.Quantity, i.Status, i.ReadyByUserId })
            .ToListAsync();

        var dishNames = await _db.Dishes
            .Select(d => new { d.Id, d.Name })
            .ToDictionaryAsync(d => d.Id);

        var ci = System.Globalization.CultureInfo.GetCultureInfo("ru-RU");
        var nameOf = (int? id) => id.HasValue && users.TryGetValue(id.Value, out var u) ? u.Login : null;

        var result = rows.Select(o =>
        {
            var mine = itemRows.Where(i => i.OrderId == o.Id).ToList();

            return new
            {
                id = o.Id,
                servedAt = o.ServedAt,
                date = o.ServedAt?.ToString("yyyy-MM-dd"),
                time = o.ServedAt?.ToString("HH:mm", ci),
                tableNumber = o.TableNumber,
                isTakeaway = o.TableNumber == null,
                // Состав одной строкой: «Крем-суп ×2, Борщ ×1»
                dishes = string.Join(", ", mine
                    .GroupBy(i => i.DishId)
                    .Select(g => $"{dishNames.GetValueOrDefault(g.Key)?.Name ?? "блюдо"} ×{g.Sum(x => x.Quantity)}")),
                dishCount = mine.Sum(i => i.Quantity),
                // Повар — тот, кто отметил блюда готовыми
                cook = nameOf(mine.FirstOrDefault(i => i.ReadyByUserId.HasValue)?.ReadyByUserId),
                waiter = nameOf(o.ServedByUserId)
            };
        });

        // Фильтр по сотруднику — уже после выборки, сравниваем логины
        var list = result.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(user))
        {
            var u = user.Trim().ToLower();
            list = list.Where(x => x.cook?.ToLower() == u || x.waiter?.ToLower() == u);
        }

        return Ok(list.ToList());
    }

    // POST /api/orders/{id}/cancel — отмена заказа с возвратом товара на склад.
    // Повару тоже можно: гость не пришёл, заказ снимаем с кухни и возвращаем
    // продукты на склад по тем же партиям, откуда они ушли.
    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "Waiter,Cook,Manager")]
    public async Task<ActionResult> Cancel(int id)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order is null)
            return NotFound(new { error = "Заказ не найден" });
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest(new { error = "Заказ уже отменён" });

        var items = await _db.OrderItems.Where(i => i.OrderId == id).ToListAsync();
        if (items.Any(i => i.Status == OrderItemStatus.Ready))
            return BadRequest(new { error = "Заказ уже начали готовить — отменить нельзя" });

        var movements = await _db.StockMovements.Where(m => m.OrderId == id).ToListAsync();
        if (movements.Count == 0)
            return BadRequest(new { error = "По заказу нет списаний — нечего возвращать" });

        var userId = GetUserId();

        // Возвращаем количество в те же партии, откуда оно ушло
        foreach (var m in movements)
        {
            var back = await _db.ProductBatches.FirstOrDefaultAsync(b => b.Id == m.BatchId);
            if (back is null) continue;

            back.Quantity += Math.Abs(m.QuantityDelta);

            _db.StockMovements.Add(new StockMovement
            {
                ProductId = m.ProductId,
                BatchId = m.BatchId,
                QuantityDelta = Math.Abs(m.QuantityDelta),
                Type = MovementType.Return,
                Reason = null,
                OrderId = id,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });
        }

        order.Status = OrderStatus.Cancelled;
        await _db.SaveChangesAsync();

        return Ok(new { order.Id, status = order.Status.ToString(), returned = movements.Count });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}