using Flagman.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager,Cook")]
public class PurchaseSuggestionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PurchaseSuggestionsController(AppDbContext db) => _db = db;

    // GET /api/purchase-suggestions — что и сколько докупить
    [HttpGet("api/purchase-suggestions")]
    public async Task<ActionResult> Get()
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
                    .Sum(b => (decimal?)b.Quantity) ?? 0
            })
            .ToListAsync();

        // Предлагаем докупить только там, где остаток упал ниже минимального
        var items = rows
            .Where(x => x.quantity < x.MinStock)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Unit,
                quantity = x.quantity,
                minStock = x.MinStock,
                toOrder = Math.Round(x.MinStock - x.quantity, 2),
                reason = $"Остаток {x.quantity:0.00} {x.Unit} при минимуме {x.MinStock:0.00} {x.Unit}"
            });

        return Ok(items);
    }
}