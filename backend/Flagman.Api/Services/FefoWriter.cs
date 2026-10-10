using Flagman.Api.Data;
using Flagman.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Services;

// Ошибка «не хватает продукта». Текст показываем пользователю как есть
public class NotEnoughStockException : Exception
{
    public NotEnoughStockException(string message) : base(message) { }
}

public static class FefoWriter
{
    // Списание по заказу: только непросроченные партии, сначала с ближайшим сроком
    public static async Task WriteOffForOrder(
        AppDbContext db, int productId, decimal needed, int orderId, int userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var batches = await db.ProductBatches
            .Where(b => b.ProductId == productId && b.Quantity > 0 && b.ExpiryDate >= today)
            .OrderBy(b => b.ExpiryDate).ThenBy(b => b.Id)
            .ToListAsync();

        await Consume(db, batches, needed, productId, orderId, MovementType.Order, null, userId);
    }

    // Ручное списание: включая просрочку — она уходит первой
    public static async Task WriteOffManual(
        AppDbContext db, int productId, decimal needed, WriteOffReason reason, int userId)
    {
        var batches = await db.ProductBatches
            .Where(b => b.ProductId == productId && b.Quantity > 0)
            .OrderBy(b => b.ExpiryDate).ThenBy(b => b.Id)
            .ToListAsync();

        await Consume(db, batches, needed, productId, null, MovementType.WriteOff, reason, userId);
    }

    // Общая часть: идём по партиям по порядку и уменьшаем остатки
    private static async Task Consume(
        AppDbContext db, List<ProductBatch> batches, decimal needed, int productId,
        int? orderId, MovementType type, WriteOffReason? reason, int userId)
    {
        var total = batches.Sum(b => b.Quantity);

        if (total < needed)
        {
            var product = await db.Products.FindAsync(productId);
            throw new NotEnoughStockException(
                $"Недостаточно {product?.Name?.ToLower()}: нужно {needed:0.00} {product?.Unit}, доступно {total:0.00} {product?.Unit}");
        }

        var left = needed;

        foreach (var batch in batches)
        {
            if (left <= 0) break;

            var take = Math.Min(batch.Quantity, left);
            batch.Quantity -= take;
            left -= take;

            db.StockMovements.Add(new StockMovement
            {
                ProductId = productId,
                BatchId = batch.Id,
                QuantityDelta = -take,
                Type = type,
                Reason = reason,
                OrderId = orderId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });
        }
    }
}