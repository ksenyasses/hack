using Flagman.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Services;

public static class AvailabilityService
{
    // Сколько порций блюда можно приготовить прямо сейчас.
    // Просроченные партии не считаются, пустые — тоже.
    public static async Task<(int Portions, string? Reason)> Check(AppDbContext db, int dishId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var recipe = await db.RecipeItems
            .Where(r => r.DishId == dishId)
            .Select(r => new { r.ProductId, r.QuantityPerPortion })
            .ToListAsync();

        if (recipe.Count == 0)
            return (0, "У блюда не задан рецепт");

        var portions = int.MaxValue;
        string? reason = null;

        foreach (var item in recipe)
        {
            var product = await db.Products.FindAsync(item.ProductId);
            var unit = product?.Unit ?? "";

            var available = await db.ProductBatches
                .Where(b => b.ProductId == item.ProductId
                            && b.Quantity > 0
                            && b.ExpiryDate >= today)
                .SumAsync(b => (decimal?)b.Quantity) ?? 0;

            var canCook = item.QuantityPerPortion <= 0
                ? 0
                : (int)Math.Floor(available / item.QuantityPerPortion);

            // Запоминаем самый «узкий» ингредиент — именно он решает
            if (canCook < portions)
            {
                portions = canCook;
                reason = $"Недостаточно {product?.Name}: нужно {item.QuantityPerPortion:0.00} {unit}, доступно {available:0.00} {unit}";
            }
        }

        if (portions >= 1)
            reason = null;

        return (portions == int.MaxValue ? 0 : portions, reason);
    }
}