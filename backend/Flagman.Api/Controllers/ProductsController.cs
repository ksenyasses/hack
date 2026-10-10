using Flagman.Api.Data;
using Flagman.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Flagman.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProductsController(AppDbContext db) => _db = db;

    public record ProductRequest(string Name, string Unit, decimal MinStock, int ShelfLifeDays);

    // GET /api/products — список продуктов (архивные не показываем)
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _db.Products
            .Where(p => !p.IsArchived)
            .OrderBy(p => p.Name)
            .Select(p => new { p.Id, p.Name, p.Unit, p.MinStock, p.ShelfLifeDays })
            .ToListAsync();

        return Ok(items);
    }

    // POST /api/products — добавить продукт
    [HttpPost]
    [Authorize(Roles = "Manager,Cook")]
    public async Task<ActionResult> Create(ProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Название продукта не может быть пустым" });

        var exists = await _db.Products.AnyAsync(p => p.Name == request.Name && !p.IsArchived);
        if (exists)
            return BadRequest(new { error = "Продукт с таким названием уже есть" });

        var product = new Product
        {
            Name = request.Name.Trim(),
            Unit = request.Unit,
            MinStock = request.MinStock,
            ShelfLifeDays = request.ShelfLifeDays
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        return Ok(new { product.Id, product.Name, product.Unit, product.MinStock, product.ShelfLifeDays });
    }

    // PUT /api/products/{id} — изменить продукт
    [HttpPut("{id}")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Update(int id, ProductRequest request)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null)
            return NotFound(new { error = "Продукт не найден" });

        product.Name = request.Name.Trim();
        product.Unit = request.Unit;
        product.MinStock = request.MinStock;
        product.ShelfLifeDays = request.ShelfLifeDays;

        await _db.SaveChangesAsync();
        return Ok(new { product.Id, product.Name, product.Unit, product.MinStock, product.ShelfLifeDays });
    }

    // DELETE /api/products/{id} — «удаление» = убрать в архив
    [HttpDelete("{id}")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult> Archive(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null)
            return NotFound(new { error = "Продукт не найден" });

        product.IsArchived = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Продукт убран в архив" });
    }
}