using Flagman.Api.Data;
using Flagman.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager,Cook")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnalyticsController(AppDbContext db) => _db = db;

    // GET /api/analytics/writeoffs?from=2026-10-01&to=2026-10-10
    // Что и почему списывали за период
    [HttpGet("api/analytics/writeoffs")]
    public async Task<ActionResult> WriteOffs(
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _db.StockMovements.Where(m => m.Type == MovementType.WriteOff);

        // Даты фильтра считаем местным временем сервера и переводим в UTC:
        // PostgreSQL принимает только время, помеченное как UTC
        if (from.HasValue)
        {
            var fromDate = DateTime.SpecifyKind(
                from.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();

            query = query.Where(m => m.CreatedAt >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = DateTime.SpecifyKind(
                to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Local).ToUniversalTime();

            query = query.Where(m => m.CreatedAt < toDate);
        }

        var rows = await query
            .Select(m => new { m.ProductId, m.QuantityDelta, m.Reason })
            .ToListAsync();

        var products = await _db.Products
            .Select(p => new { p.Id, p.Name, p.Unit })
            .ToListAsync();

        var productInfo = products.ToDictionary(p => p.Id);

        // По причинам считаем КОЛИЧЕСТВО операций:
        // килограммы с литрами и штуками складывать нельзя
        var byReason = rows
            .GroupBy(m => m.Reason?.ToString() ?? "Other")
            .Select(g => new
            {
                reason = g.Key,
                title = ReasonTitle(g.Key),
                count = g.Count()
            })
            .OrderByDescending(x => x.count)
            .ToList();

        // По продуктам — здесь единицы одинаковые, поэтому показываем и объём
        var topProducts = rows
            .GroupBy(m => m.ProductId)
            .Select(g => new
            {
                productId = g.Key,
                productName = productInfo.GetValueOrDefault(g.Key)?.Name ?? "",
                unit = productInfo.GetValueOrDefault(g.Key)?.Unit ?? "",
                quantity = Math.Abs(g.Sum(x => x.QuantityDelta)),
                count = g.Count()
            })
            .OrderByDescending(x => x.quantity)
            .ToList();

        return Ok(new
        {
            from,
            to,
            totalWriteOffs = rows.Count,
            byReason,
            topProducts
        });
    }

    // Русские названия причин списания
    private static string ReasonTitle(string reason) => reason switch
    {
        "Expiry" => "Срок годности",
        "Spoilage" => "Порча",
        "Damage" => "Повреждение",
        _ => "Другое"
    };
}