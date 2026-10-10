using Flagman.Api.Data;
using Flagman.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize]
public class MovementsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MovementsController(AppDbContext db) => _db = db;

    // GET /api/movements?limit=100&type=WriteOff&productId=1&from=2026-10-01&to=2026-10-10
    // Журнал операций, свежие сверху. Все фильтры необязательные
    [HttpGet("api/movements")]
    public async Task<ActionResult> Get(
        [FromQuery] int limit = 100,
        [FromQuery] string? type = null,
        [FromQuery] int? productId = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        if (limit <= 0 || limit > 500)
            limit = 100;

        var query = _db.StockMovements.AsQueryable();

        // Фильтр по типу операции: Receipt, Order, WriteOff
        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<MovementType>(type, true, out var parsedType))
            query = query.Where(m => m.Type == parsedType);

        // Фильтр по продукту
        if (productId.HasValue)
            query = query.Where(m => m.ProductId == productId.Value);

        // Фильтр по датам.
        // Дату из фильтра считаем в местном времени сервера и переводим в UTC:
        // PostgreSQL принимает только время, помеченное как UTC
        if (from.HasValue)
        {
            var fromDate = DateTime.SpecifyKind(
                from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();

            query = query.Where(m => m.CreatedAt >= fromDate);
        }

        if (to.HasValue)
        {
            // Конец дня — это следующий день, 00:00, иначе записи за сам день не попадут
            var toDate = DateTime.SpecifyKind(
                to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();

            query = query.Where(m => m.CreatedAt < toDate);
        }

        var rows = await query
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

        // Enum-ы превращаем в текст уже в памяти
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