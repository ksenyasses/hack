using Flagman.Api.Data;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db) => _db = db;

    // GET /api/dashboard — счётчики и списки для главного экрана управляющего
    [HttpGet("api/dashboard")]
    public async Task<ActionResult> Get()
    {
        var today = StockHelper.Today();
        var soonLimit = today.AddDays(StockHelper.ExpiringSoonDays);

        // Остатки по продуктам: сколько всего и какой ближайший срок
        var products = await _db.Products
            .Where(p => !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Unit,
                p.MinStock,
                quantity = _db.ProductBatches
                    .Where(b => b.ProductId == p.Id)
                    .Sum(b => (decimal?)b.Quantity) ?? 0,
                nearestExpiry = _db.ProductBatches
                    .Where(b => b.ProductId == p.Id && b.Quantity > 0)
                    .Min(b => (DateOnly?)b.ExpiryDate)
            })
            .ToListAsync();

        // Партии с остатком — из них собираем списки по срокам
        var batches = await _db.ProductBatches
            .Where(b => b.Quantity > 0)
            .Select(b => new
            {
                b.Id,
                b.ProductId,
                b.Quantity,
                b.ExpiryDate,
                deliveryNumber = _db.Deliveries
                    .Where(d => d.Id == b.DeliveryId)
                    .Select(d => d.Number)
                    .FirstOrDefault()
            })
            .ToListAsync();

        var productInfo = products.ToDictionary(p => p.Id);

        // Список «Скоро истекает»: срок ещё не прошёл, но уже близко
        var expiringSoon = batches
            .Where(b => b.ExpiryDate >= today && b.ExpiryDate <= soonLimit)
            .OrderBy(b => b.ExpiryDate)
            .Select(b => new
            {
                productName = productInfo.GetValueOrDefault(b.ProductId)?.Name ?? "",
                unit = productInfo.GetValueOrDefault(b.ProductId)?.Unit ?? "",
                b.Quantity,
                b.ExpiryDate,
                daysLeft = StockHelper.DaysLeft(b.ExpiryDate),
                b.deliveryNumber
            })
            .ToList();

        // Список «Просрочено» — на списание
        var expired = batches
            .Where(b => b.ExpiryDate < today)
            .OrderBy(b => b.ExpiryDate)
            .Select(b => new
            {
                productName = productInfo.GetValueOrDefault(b.ProductId)?.Name ?? "",
                unit = productInfo.GetValueOrDefault(b.ProductId)?.Unit ?? "",
                b.Quantity,
                b.ExpiryDate,
                daysOverdue = Math.Abs(StockHelper.DaysLeft(b.ExpiryDate)),
                b.deliveryNumber
            })
            .ToList();

        // Список «Заканчивается»: остаток ниже минимального
        var runningLow = products
            .Where(p => p.quantity < p.MinStock)
            .Select(p => new
            {
                p.Name,
                p.Unit,
                quantity = p.quantity,
                p.MinStock,
                toOrder = Math.Round(p.MinStock - p.quantity, 2)
            })
            .ToList();

        // Блюда в стоп-листе — считаем тем же сервисом, что и раздел «Стоп-лист»
        var dishes = await _db.Dishes.OrderBy(d => d.Name).ToListAsync();
        var stopList = new List<object>();

        foreach (var dish in dishes)
        {
            var (portions, reason) = await AvailabilityService.Check(_db, dish.Id);
            if (portions <= 0)
                stopList.Add(new { dish.Id, dish.Name, reason });
        }

        return Ok(new
        {
            // Сгенерировано — полезно, чтобы фронт показал «данные на 14:35»
            generatedAt = DateTime.UtcNow,

            counters = new
            {
                products = products.Count,
                dishesInStopList = stopList.Count,
                expiringSoon = expiringSoon.Count,
                expired = expired.Count
            },

            expiringSoon,
            expired,
            runningLow,
            stopList
        });
    }
}