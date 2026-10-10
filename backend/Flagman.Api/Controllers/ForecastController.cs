using Flagman.Api.Data;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize(Roles = "Manager,Cook")]
public class ForecastController : ControllerBase
{
    private readonly AppDbContext _db;

    public ForecastController(AppDbContext db) => _db = db;

    private record ForecastItem(
        int DishId,
        string DishName,
        int AvailablePortions,
        int SoldPortions,
        double PortionsPerDay,
        double? DaysLeft,
        string? LimitingProduct,
        string Status,
        string Comment);

    // GET /api/forecast/stop-list?days=7
    // Прогноз: когда блюдо уйдёт в стоп-лист при текущем темпе продаж
    [HttpGet("api/forecast/stop-list")]
    public async Task<ActionResult> StopListForecast([FromQuery] int days = 7)
    {
        if (days <= 0 || days > 90)
            days = 7;

        var since = DateTime.UtcNow.AddDays(-days);

        // Сколько порций каждого блюда продано за период
        var soldRows = await _db.OrderItems
            .Where(i => _db.Orders.Any(o => o.Id == i.OrderId && o.CreatedAt >= since))
            .Select(i => new { i.DishId, i.Quantity })
            .ToListAsync();

        var soldByDish = soldRows
            .GroupBy(i => i.DishId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

        var dishes = await _db.Dishes.OrderBy(d => d.Name).ToListAsync();
        var result = new List<ForecastItem>();

        foreach (var dish in dishes)
        {
            var (portions, reason) = await AvailabilityService.Check(_db, dish.Id);
            var sold = soldByDish.GetValueOrDefault(dish.Id);
            var perDay = Math.Round((double)sold / days, 1);
            var limiting = await AvailabilityService.LimitingProduct(_db, dish.Id);

            double? daysLeft;
            string status;
            string comment;

            if (portions <= 0)
            {
                daysLeft = 0;
                status = "В стоп-листе";
                comment = reason ?? "Недоступно";
            }
            else if (perDay <= 0)
            {
                daysLeft = null;
                status = "Нет продаж";
                comment = "За период не продавалось — прогноз построить нельзя";
            }
            else
            {
                daysLeft = Math.Round(portions / perDay, 1);
                status = daysLeft <= 1 ? "Скоро закончится" : "Работает";
                comment = $"При текущем темпе хватит примерно на {daysLeft} дн.";
            }

            result.Add(new ForecastItem(
                dish.Id, dish.Name, portions, sold, perDay, daysLeft,
                limiting, status, comment));
        }

        // Сначала те, что уже в стопе или закончатся раньше всех; без прогноза — в конце
        var ordered = result.OrderBy(x => x.DaysLeft ?? double.MaxValue).ToList();

        return Ok(new
        {
            periodDays = days,
            atRisk = result.Count(x => x.Status is "В стоп-листе" or "Скоро закончится"),
            dishes = ordered
        });
    }
}