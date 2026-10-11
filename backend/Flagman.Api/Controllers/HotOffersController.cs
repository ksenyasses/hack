using System.Globalization;
using Flagman.Api.Data;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Authorize]
public class HotOffersController : ControllerBase
{
    private readonly AppDbContext _db;

    public HotOffersController(AppDbContext db) => _db = db;

    private record Offer(int Id, string Name, double Priority, int CoverPortions, string? Reason, bool IsPromo);

    // Русская форма слова «порция» для числа: 1 порция, 2 порции, 5 порций
    private static string PortionsWord(int n)
    {
        var n100 = n % 100;
        if (n100 >= 11 && n100 <= 14) return "порций";
        var n10 = n % 10;
        if (n10 == 1) return "порция";
        if (n10 >= 2 && n10 <= 4) return "порции";
        return "порций";
    }

    // GET /api/hot-offers — что продавать в первую очередь и почему
    [HttpGet("api/hot-offers")]
    public async Task<ActionResult> Get()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var limit = today.AddDays(StockHelper.ExpiringSoonDays);

        // 1. Горящие партии: есть остаток, срок уже близко или прошёл
        var hot = await _db.ProductBatches
            .Where(b => b.Quantity > 0 && b.ExpiryDate <= limit)
            .Select(b => new { b.ProductId, b.Quantity, b.ExpiryDate })
            .ToListAsync();

        // 2. Группируем по продукту ТОЛЬКО не просроченные партии:
        //    просроченное нельзя предлагать продавать — его списываем (см. toWriteOff ниже)
        var hotByProduct = hot
            .Where(b => b.ExpiryDate >= today)
            .GroupBy(b => b.ProductId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    Quantity = g.Sum(x => x.Quantity),
                    Expiry = g.Min(x => x.ExpiryDate)
                });

        // 3. Справочник продуктов
        var products = await _db.Products
            .Select(p => new { p.Id, p.Name, p.Unit })
            .ToListAsync();
        var productInfo = products.ToDictionary(p => p.Id);

        // 4. Просроченное — не в предложения, а на списание
        var writeOff = hot
            .Where(b => b.ExpiryDate < today)
            .GroupBy(b => b.ProductId)
            .Select(g => new
            {
                productId = g.Key,
                productName = productInfo.GetValueOrDefault(g.Key)?.Name ?? "",
                unit = productInfo.GetValueOrDefault(g.Key)?.Unit ?? "",
                quantity = g.Sum(x => x.Quantity),
                expiryDate = g.Min(x => x.ExpiryDate),
                daysOverdue = Math.Abs(StockHelper.DaysLeft(g.Min(x => x.ExpiryDate)))
            })
            .ToList();

        // 5. Считаем приоритет каждого блюда
        var dishes = await _db.Dishes.ToListAsync();
        var offers = new List<Offer>();

        foreach (var dish in dishes)
        {
            var recipe = await _db.RecipeItems
                .Where(r => r.DishId == dish.Id)
                .Select(r => new { r.ProductId, r.QuantityPerPortion })
                .ToListAsync();

            double score = 0;
            double bestContribution = 0;
            int coverPortions = 0;
            string? reason = null;

            foreach (var item in recipe)
            {
                if (item.QuantityPerPortion <= 0) continue;
                if (!hotByProduct.TryGetValue(item.ProductId, out var h)) continue;

                var daysLeft = Math.Max(StockHelper.DaysLeft(h.Expiry), 0);
                var urgency = 1.0 / (daysLeft + 1);
                var cover = (int)Math.Floor(h.Quantity / item.QuantityPerPortion);
                if (cover <= 0) continue;

                var contribution = urgency * cover;
                score += contribution;

                if (contribution > bestContribution)
                {
                    bestContribution = contribution;
                    coverPortions = cover;

                    var name = productInfo.GetValueOrDefault(item.ProductId)?.Name ?? "продукт";
                    var unit = productInfo.GetValueOrDefault(item.ProductId)?.Unit ?? "";

                    // Число всегда с запятой, независимо от локали сервера
                    var q = h.Quantity.ToString("0.00", CultureInfo.GetCultureInfo("ru-RU"));
                    var portions = PortionsWord(cover);

                    reason = daysLeft == 0
                        ? $"{name}: срок истекает сегодня, остаток {q} {unit} — хватит на {cover} {portions}"
                        : $"{name}: срок {daysLeft} дн., остаток {q} {unit} — хватит на {cover} {portions}";
                }
            }

            if (score <= 0) continue;

            var isPromo = dish.PromoUntil != null && dish.PromoUntil >= today;
            offers.Add(new Offer(dish.Id, dish.Name, Math.Round(score, 1), coverPortions, reason, isPromo));
        }

        return Ok(new
        {
            offers = offers.OrderByDescending(o => o.Priority),
            toWriteOff = writeOff
        });
    }
}