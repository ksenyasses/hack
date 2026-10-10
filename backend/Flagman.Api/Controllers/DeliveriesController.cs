using System.Security.Claims;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize(Roles = "Manager,Cook")]
public class DeliveriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public DeliveriesController(AppDbContext db) => _db = db;

    public record DeliveryItemRequest(int ProductId, decimal Quantity, DateOnly? ExpiryDate);
    public record DeliveryRequest(string Number, string? Comment, List<DeliveryItemRequest> Items);

    // POST /api/deliveries — приёмка поставки: создаёт партии и считает срок годности
    [HttpPost]
    public async Task<ActionResult> Create(DeliveryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Number))
            return BadRequest(new { error = "Укажите номер поставки" });

        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { error = "В поставке нет ни одного продукта" });

        if (await _db.Deliveries.AnyAsync(d => d.Number == request.Number))
            return BadRequest(new { error = "Поставка с таким номером уже есть" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var userId = GetUserId();

        var delivery = new Delivery
        {
            Number = request.Number.Trim(),
            Comment = request.Comment,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        var created = new List<(ProductBatch Batch, StockMovement Movement)>();
        var productNames = new Dictionary<int, string>();

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0)
                return BadRequest(new { error = "Количество должно быть больше нуля" });

            var product = await _db.Products.FindAsync(item.ProductId);
            if (product is null || product.IsArchived)
                return BadRequest(new { error = $"Продукт с id {item.ProductId} не найден" });

            // Если срок указан вручную — берём его. Если нет — считаем: сегодня + срок хранения продукта
            var expiry = item.ExpiryDate ?? today.AddDays(product.ShelfLifeDays);

            if (expiry < today)
                return BadRequest(new { error = $"У продукта «{product.Name}» указан уже прошедший срок годности" });

            productNames[product.Id] = product.Name;

            var batch = new ProductBatch
            {
                ProductId = product.Id,
                Quantity = item.Quantity,
                ExpiryDate = expiry,
                ReceivedAt = DateTime.UtcNow
            };

            var movement = new StockMovement
            {
                ProductId = product.Id,
                QuantityDelta = item.Quantity,
                Type = MovementType.Receipt,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            created.Add((batch, movement));
        }

        // Партии и движения сохраняем одной транзакцией:
        // сначала партии (чтобы получить их Id), потом движения с ссылкой на партию
        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.Deliveries.Add(delivery);
        await _db.SaveChangesAsync();

        foreach (var (batch, _) in created)
        {
            batch.DeliveryId = delivery.Id;
            _db.ProductBatches.Add(batch);
        }
        await _db.SaveChangesAsync();

        foreach (var (batch, movement) in created)
        {
            movement.BatchId = batch.Id;
            _db.StockMovements.Add(movement);
        }
        await _db.SaveChangesAsync();

        await tx.CommitAsync();

        var batches = created.Select(x => new
        {
            id = x.Batch.Id,
            productId = x.Batch.ProductId,
            productName = productNames[x.Batch.ProductId],
            quantity = x.Batch.Quantity,
            expiryDate = x.Batch.ExpiryDate,
            daysLeft = StockHelper.DaysLeft(x.Batch.ExpiryDate),
            status = StockHelper.Status(x.Batch.ExpiryDate, x.Batch.Quantity)
        });

        return Ok(new
        {
            delivery.Id,
            delivery.Number,
            delivery.CreatedAt,
            batches
        });
    }

    // GET /api/deliveries — список поставок
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _db.Deliveries
            .OrderByDescending(d => d.Id)
            .Select(d => new
            {
                d.Id,
                d.Number,
                d.CreatedAt,
                d.Comment,
                batchCount = _db.ProductBatches.Count(b => b.DeliveryId == d.Id)
            })
            .ToListAsync();

        return Ok(items);
    }

    // Id пользователя из токена. Пока токена нет — считаем, что это первый пользователь
    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}