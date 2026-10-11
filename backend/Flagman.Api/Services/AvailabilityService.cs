using Flagman.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Flagman.Api.Services;

public static class AvailabilityService
{
    // Сколько порций блюда можно приготовить прямо сейчас.
    // Просроченные партии не считаются, пустые — тоже.
    public static async Task<(int Portions, string? Reason)> Check(AppDbContext db, int dishId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var dish = await db.Dishes.FindAsync(dishId);
        if (dish is null)
            return (0, "Блюдо не найдено");

        // Скрытое вручную блюдо недоступно, даже если продукты есть
        if (dish.IsManuallyStopped)
            return (0, "Скрыто вручную");

        var recipe = await db.RecipeItems
            .Where(r => r.DishId == dishId)
            .Select(r => new { r.ProductId, r.QuantityPerPortion })
            .ToListAsync();

        if (recipe.Count == 0)
            return (0, "У блюда не задан рецепт");

        var portions = int.MaxValue;
        string? reason = null;
        
        var ci = CultureInfo.GetCultureInfo("ru-RU");
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
                reason = $"Недостаточно «{product?.Name}»: нужно {item.QuantityPerPortion.ToString("0.00", ci)} {unit}, доступно {available.ToString("0.00", ci)} {unit}";
            }
        }

        if (portions >= 1)
            reason = null;

        return (portions == int.MaxValue ? 0 : portions, reason);
    }

    // Название продукта, который ограничивает приготовление — «узкое место».
    // Нужен для прогноза: «хватит на 5 дней, ограничивает курица»
    public static async Task<string?> LimitingProduct(AppDbContext db, int dishId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var recipe = await db.RecipeItems
            .Where(r => r.DishId == dishId)
            .Select(r => new { r.ProductId, r.QuantityPerPortion })
            .ToListAsync();

        string? worst = null;
        var worstPortions = int.MaxValue;

        foreach (var item in recipe)
        {
            if (item.QuantityPerPortion <= 0) continue;

            var available = await db.ProductBatches
                .Where(b => b.ProductId == item.ProductId && b.Quantity > 0 && b.ExpiryDate >= today)
                .SumAsync(b => (decimal?)b.Quantity) ?? 0;

            var canCook = (int)Math.Floor(available / item.QuantityPerPortion);

            if (canCook < worstPortions)
            {
                worstPortions = canCook;
                var product = await db.Products.FindAsync(item.ProductId);
                worst = product?.Name;
            }
        }

        return worst;
    }
}