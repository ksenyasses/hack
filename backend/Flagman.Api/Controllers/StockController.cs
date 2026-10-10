using Flagman.Api.Data;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager,Cook")]
public class StockController : ControllerBase
{
    private readonly AppDbContext _db;

    public StockController(AppDbContext db) => _db = db;

    // GET /api/stock — остатки с агрегацией по продукту
    [HttpGet("api/stock")]
    public async Task<ActionResult> GetStock()
    {
        var rows = await _db.Products
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

        var items = rows.Select(x => new
        {
            x.Id,
            x.Name,
            x.Unit,
            x.MinStock,
            quantity = x.quantity,
            nearestExpiry = x.nearestExpiry,
            daysLeft = x.nearestExpiry.HasValue ? StockHelper.DaysLeft(x.nearestExpiry.Value) : (int?)null,
            status = x.quantity <= 0
                ? "Закончился"
                : StockHelper.Status(x.nearestExpiry!.Value, x.quantity),
            belowMinStock = x.quantity < x.MinStock
        });

        return Ok(items);
    }

    // GET /api/batches — остатки по партиям, ближайшие к истечению сверху
    [HttpGet("api/batches")]
    public async Task<ActionResult> GetBatches()
    {
        var rows = await _db.ProductBatches
            .Where(b => b.Quantity > 0)
            .OrderBy(b => b.ExpiryDate)
            .Select(b => new
            {
                b.Id,
                b.ProductId,
                productName = _db.Products
                    .Where(p => p.Id == b.ProductId)
                    .Select(p => p.Name)
                    .FirstOrDefault(),
                b.Quantity,
                b.ExpiryDate,
                b.ReceivedAt,
                deliveryNumber = _db.Deliveries
                    .Where(d => d.Id == b.DeliveryId)
                    .Select(d => d.Number)
                    .FirstOrDefault()
            })
            .ToListAsync();

        var items = rows.Select(x => new
        {
            x.Id,
            x.ProductId,
            x.productName,
            x.Quantity,
            x.ExpiryDate,
            x.ReceivedAt,
            x.deliveryNumber,
            daysLeft = StockHelper.DaysLeft(x.ExpiryDate),
            status = StockHelper.Status(x.ExpiryDate, x.Quantity)
        });

        return Ok(items);
    }
}