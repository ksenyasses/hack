using System.Security.Claims;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/writeoffs")]
public class WriteOffsController : ControllerBase
{
    private readonly AppDbContext _db;

    public WriteOffsController(AppDbContext db) => _db = db;

    public record WriteOffRequest(int ProductId, decimal Quantity, WriteOffReason Reason);

    // POST /api/writeoffs — списание испорченного или просроченного
    [HttpPost]
    public async Task<ActionResult> Create(WriteOffRequest request)
    {
        if (request.Quantity <= 0)
            return BadRequest(new { error = "Количество должно быть больше нуля" });

        var product = await _db.Products.FindAsync(request.ProductId);
        if (product is null || product.IsArchived)
            return BadRequest(new { error = $"Продукт с id {request.ProductId} не найден" });

        var userId = GetUserId();

        await using var tx = await _db.Database.BeginTransactionAsync();

        try
        {
            await FefoWriter.WriteOffManual(_db, request.ProductId, request.Quantity, request.Reason, userId);
            await _db.SaveChangesAsync();
        }
        catch (NotEnoughStockException ex)
        {
            await tx.RollbackAsync();
            return BadRequest(new { error = ex.Message });
        }

        await tx.CommitAsync();

        return Ok(new
        {
            message = "Списано",
            productId = request.ProductId,
            quantity = request.Quantity,
            reason = request.Reason.ToString()
        });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}