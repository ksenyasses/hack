using System.Security.Claims;
using System.Globalization;
using Flagman.Api.Data;
using Flagman.Api.Models;
using Flagman.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

// Заявки на списание: повар просит, управляющий подтверждает.
// Создание заявки НЕ трогает склад — товар уходит только после подтверждения.
[ApiController]
[Route("api/writeoff-requests")]
[Authorize]
public class WriteOffRequestsController : ControllerBase
{
    private readonly AppDbContext _db;

    public WriteOffRequestsController(AppDbContext db) => _db = db;

    public record RequestBody(int ProductId, decimal Quantity, WriteOffReason Reason,
                              string? Comment = null);

    // POST /api/writeoff-requests — повар отправляет заявку
    [HttpPost]
    [Authorize(Roles = "Cook,Manager")]
    public async Task<ActionResult> Create(RequestBody body)
    {
        if (body.Quantity <= 0)
            return BadRequest(new { error = "Количество должно быть больше нуля" });

        // Для «Другое» текст обязателен — иначе причина ничего не значит
        if (body.Reason == WriteOffReason.Other && string.IsNullOrWhiteSpace(body.Comment))
            return BadRequest(new { error = "Для причины «Другое» напишите, что случилось" });

        var product = await _db.Products.FindAsync(body.ProductId);
        if (product is null || product.IsArchived)
            return BadRequest(new { error = $"Продукт с id {body.ProductId} не найден" });

        var request = new WriteOffRequest
        {
            ProductId = body.ProductId,
            Quantity = body.Quantity,
            Reason = body.Reason,
            Comment = string.IsNullOrWhiteSpace(body.Comment) ? null : body.Comment.Trim(),
            CreatedByUserId = GetUserId(),
            CreatedAt = DateTime.UtcNow
        };

        _db.WriteOffRequests.Add(request);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            request.Id,
            status = request.Status.ToString(),
            request.CreatedAt
        });
    }

    // GET /api/writeoff-requests — список заявок. Без параметра отдаём все,
    // ожидающие первыми. ?status=Pending оставит только нерассмотренные.
    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] string? status = null)
    {
        var query = _db.WriteOffRequests.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<WriteOffRequestStatus>(status, true, out var parsed))
        {
            query = query.Where(r => r.Status == parsed);
        }

        var rows = await query
            .OrderBy(r => r.Status == WriteOffRequestStatus.Pending ? 0 : 1)
            .ThenByDescending(r => r.Id)
            .Select(r => new
            {
                r.Id,
                r.ProductId,
                productName = _db.Products.Where(p => p.Id == r.ProductId).Select(p => p.Name).FirstOrDefault(),
                unit = _db.Products.Where(p => p.Id == r.ProductId).Select(p => p.Unit).FirstOrDefault(),
                r.Quantity,
                reason = r.Reason.ToString(),
                r.Comment,
                status = r.Status.ToString(),
                createdBy = _db.Users.Where(u => u.Id == r.CreatedByUserId).Select(u => u.FullName).FirstOrDefault(),
                r.CreatedAt,
                decidedBy = _db.Users.Where(u => u.Id == r.DecidedByUserId).Select(u => u.FullName).FirstOrDefault(),
                r.DecidedAt
            })
            .ToListAsync();

        return Ok(rows);
    }

    // POST /api/writeoff-requests/{id}/approve — управляющий подтверждает.
    // Только здесь товар реально списывается, по FEFO, в одной транзакции.
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Approve(int id)
    {
        var request = await _db.WriteOffRequests.FindAsync(id);
        if (request is null)
            return NotFound(new { error = "Заявка не найдена" });
        if (request.Status != WriteOffRequestStatus.Pending)
            return BadRequest(new { error = "Заявка уже рассмотрена" });

        var userId = GetUserId();

        await using var tx = await _db.Database.BeginTransactionAsync();

        try
        {
            await FefoWriter.WriteOffManual(
                _db, request.ProductId, request.Quantity, request.Reason, userId, request.Comment);
            await _db.SaveChangesAsync();
        }
        catch (NotEnoughStockException ex)
        {
            await tx.RollbackAsync();
            return BadRequest(new { error = ex.Message });
        }

        request.Status = WriteOffRequestStatus.Approved;
        request.DecidedByUserId = userId;
        request.DecidedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await tx.CommitAsync();

        return Ok(new
        {
            request.Id,
            status = request.Status.ToString(),
            request.DecidedAt
        });
    }

    // POST /api/writeoff-requests/{id}/reject — управляющий отклонил
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Reject(int id)
    {
        var request = await _db.WriteOffRequests.FindAsync(id);
        if (request is null)
            return NotFound(new { error = "Заявка не найдена" });
        if (request.Status != WriteOffRequestStatus.Pending)
            return BadRequest(new { error = "Заявка уже рассмотрена" });

        request.Status = WriteOffRequestStatus.Rejected;
        request.DecidedByUserId = GetUserId();
        request.DecidedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { request.Id, status = request.Status.ToString() });
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 1;
    }
}