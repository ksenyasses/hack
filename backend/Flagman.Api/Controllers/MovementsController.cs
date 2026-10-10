using Flagman.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize]
public class MovementsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MovementsController(AppDbContext db) => _db = db;

    // GET /api/movements?limit=100 — журнал операций, свежие сверху
    [HttpGet("api/movements")]
    public async Task<ActionResult> Get([FromQuery] int limit = 100)
    {
        if (limit <= 0 || limit > 500)
            limit = 100;

        var rows = await _db.StockMovements
            .OrderByDescending(m => m.Id)
            .Take(limit)
            .Select(m => new
            {
                m.Id,
                m.CreatedAt,
                productName = _db.Products
                    .Where(p => p.Id == m.ProductId).Select(p => p.Name).FirstOrDefault(),
                userName = _db.Users
                    .Where(u => u.Id == m.UserId).Select(u => u.FullName).FirstOrDefault(),
                m.BatchId,
                batchExpiry = _db.ProductBatches
                    .Where(b => b.Id == m.BatchId).Select(b => (DateOnly?)b.ExpiryDate).FirstOrDefault(),
                m.QuantityDelta,
                m.Type,
                m.Reason,
                m.OrderId
            })
            .ToListAsync();

        // Enum-ы превращаем в текст уже в памяти: в запрос к базе такое не переводится
        var items = rows.Select(m => new
        {
            m.Id,
            m.CreatedAt,
            m.productName,
            m.userName,
            m.BatchId,
            m.batchExpiry,
            m.QuantityDelta,
            type = m.Type.ToString(),
            reason = m.Reason?.ToString(),
            m.OrderId
        });

        return Ok(items);
    }
}