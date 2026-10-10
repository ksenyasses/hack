using System.Security.Claims;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;

    public OrdersController(AppDbContext db) => _db = db;

    public record OrderItemRequest(int DishId, int Quantity);
    public record OrderRequest(List<OrderItemRequest> Items);

    // POST /api/orders — заказ из нескольких блюд
    [HttpPost]
    public async Task<ActionResult> Create(OrderRequest request)
    {
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { error = "Заказ пустой" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var userId = GetUserId();
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
                    error = $"Недостаточно {product?.Name?.ToLower()}: нужно {required:0.00} {product?.Unit}, доступно {available:0.00} {product?.Unit}"
                });
            }
        }

        // 3. Пишем всё одной транзакцией: заказ, строки, списания
        await using var tx = await _db.Database.BeginTransactionAsync();

        var order = new Order { CreatedByUserId = userId, CreatedAt = DateTime.UtcNow };
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
            items = orderItems.Select(i => new { i.DishId, i.Quantity })
        });
    }

    // GET /api/orders — заказы с составом: что ушло и из какой партии
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var orders = await _db.Orders.OrderByDescending(o => o.Id).ToListAsync();
        var result = new List<object>();

        foreach (var order in orders)
        {
            var items = await _db.OrderItems
                .Where(i => i.OrderId == order.Id)
                .Select(i => new
                {
                    i.DishId,
                    dishName = _db.Dishes.Where(d => d.Id == i.DishId).Select(d => d.Name).FirstOrDefault(),
                    i.Quantity
                })
                .ToListAsync();

            var movements = await _db.StockMovements
                .Where(m => m.OrderId == order.Id)
                .Select(m => new
                {
                    m.ProductId,
                    productName = _db.Products.Where(p => p.Id == m.ProductId).Select(p => p.Name).FirstOrDefault(),
                    m.BatchId,
                    m.QuantityDelta
                })
                .ToListAsync();

            result.Add(new { order.Id, order.CreatedAt, items, movements });
        }

        return Ok(result);
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}