using Flagman.Api.Data;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize]
public class StopListController : ControllerBase
{
    private readonly AppDbContext _db;

    public StopListController(AppDbContext db) => _db = db;

    // GET /api/stop-list — блюда, которые сейчас нельзя приготовить, с причиной
    [HttpGet("api/stop-list")]
    public async Task<ActionResult> Get()
    {
        var dishes = await _db.Dishes.OrderBy(d => d.Name).ToListAsync();
        var result = new List<object>();

        foreach (var dish in dishes)
        {
            var (portions, reason) = await AvailabilityService.Check(_db, dish.Id);
            if (portions > 0) continue;

            result.Add(new
            {
                dish.Id,
                dish.Name,
                availablePortions = portions,
                reason
            });
        }

        return Ok(result);
    }
}