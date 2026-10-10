using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/dishes")]
[Authorize]
public class DishesController : ControllerBase
{
    private readonly AppDbContext _db;

    public DishesController(AppDbContext db) => _db = db;

    public record RecipeItemRequest(int ProductId, decimal QuantityPerPortion);
    public record DishRequest(string Name, List<RecipeItemRequest> Recipe);
    public record ManualStopRequest(bool Stopped);

    // GET /api/dishes — блюда с рецептом и доступностью
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var dishes = await _db.Dishes.OrderBy(d => d.Name).ToListAsync();
        var result = new List<object>();

        foreach (var dish in dishes)
        {
            var recipe = await _db.RecipeItems
                .Where(r => r.DishId == dish.Id)
                .Select(r => new
                {
                    r.ProductId,
                    productName = _db.Products
                        .Where(p => p.Id == r.ProductId).Select(p => p.Name).FirstOrDefault(),
                    r.QuantityPerPortion
                })
                .ToListAsync();

            var (portions, reason) = await AvailabilityService.Check(_db, dish.Id);

            result.Add(new
            {
                dish.Id,
                dish.Name,
                recipe,
                availablePortions = portions,
                inStopList = portions <= 0,
                manuallyStopped = dish.IsManuallyStopped,
                reason
            });
        }

        return Ok(result);
    }

    // POST /api/dishes — создать блюдо вместе с рецептом
    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Create(DishRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Укажите название блюда" });

        if (request.Recipe is null || request.Recipe.Count == 0)
            return BadRequest(new { error = "У блюда должен быть хотя бы один ингредиент" });

        var check = await CheckProducts(request.Recipe);
        if (check is not null)
            return BadRequest(new { error = check });

        var dish = new Dish { Name = request.Name.Trim(), CreatedAt = DateTime.UtcNow };
        _db.Dishes.Add(dish);
        await _db.SaveChangesAsync();

        foreach (var item in request.Recipe)
        {
            _db.RecipeItems.Add(new RecipeItem
            {
                DishId = dish.Id,
                ProductId = item.ProductId,
                QuantityPerPortion = item.QuantityPerPortion
            });
        }
        await _db.SaveChangesAsync();

        return Ok(new { dish.Id, dish.Name });
    }

    // PUT /api/dishes/{id} — изменить блюдо и полностью заменить рецепт
    [HttpPut("{id}")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Update(int id, DishRequest request)
    {
        var dish = await _db.Dishes.FindAsync(id);
        if (dish is null)
            return NotFound(new { error = "Блюдо не найдено" });

        if (request.Recipe is null || request.Recipe.Count == 0)
            return BadRequest(new { error = "У блюда должен быть хотя бы один ингредиент" });

        var check = await CheckProducts(request.Recipe);
        if (check is not null)
            return BadRequest(new { error = check });

        dish.Name = request.Name.Trim();

        var old = _db.RecipeItems.Where(r => r.DishId == id);
        _db.RecipeItems.RemoveRange(old);

        foreach (var item in request.Recipe)
        {
            _db.RecipeItems.Add(new RecipeItem
            {
                DishId = id,
                ProductId = item.ProductId,
                QuantityPerPortion = item.QuantityPerPortion
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new { dish.Id, dish.Name });
    }

    // PUT /api/dishes/{id}/manual-stop — скрыть блюдо вручную или вернуть в продажу
    [HttpPut("{id}/manual-stop")]
    [Authorize(Roles = "Manager,Cook")]
    public async Task<ActionResult> SetManualStop(int id, ManualStopRequest request)
    {
        var dish = await _db.Dishes.FindAsync(id);
        if (dish is null)
            return NotFound(new { error = "Блюдо не найдено" });

        dish.IsManuallyStopped = request.Stopped;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            dish.Id,
            dish.Name,
            manuallyStopped = dish.IsManuallyStopped,
            message = dish.IsManuallyStopped ? "Блюдо скрыто вручную" : "Блюдо снова в продаже"
        });
    }

    // Проверяем, что все продукты из рецепта существуют и нормы положительные
    private async Task<string?> CheckProducts(List<RecipeItemRequest> recipe)
    {
        foreach (var item in recipe)
        {
            if (item.QuantityPerPortion <= 0)
                return "Количество продукта на порцию должно быть больше нуля";

            var product = await _db.Products.FindAsync(item.ProductId);
            if (product is null || product.IsArchived)
                return $"Продукт с id {item.ProductId} не найден";
        }
        return null;
    }
}