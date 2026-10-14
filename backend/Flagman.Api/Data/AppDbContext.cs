using Microsoft.EntityFrameworkCore;
using Flagman.Api.Models;

namespace Flagman.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductBatch> ProductBatches => Set<ProductBatch>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<Dish> Dishes => Set<Dish>();
    public DbSet<RecipeItem> RecipeItems => Set<RecipeItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<WriteOffRequest> WriteOffRequests => Set<WriteOffRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Все количества — numeric(12,3), точность до грамма
        modelBuilder.Entity<Product>().Property(p => p.MinStock).HasColumnType("numeric(12,3)");
        modelBuilder.Entity<ProductBatch>().Property(b => b.Quantity).HasColumnType("numeric(12,3)");
        modelBuilder.Entity<RecipeItem>().Property(r => r.QuantityPerPortion).HasColumnType("numeric(12,3)");
        modelBuilder.Entity<StockMovement>().Property(m => m.QuantityDelta).HasColumnType("numeric(12,3)");
        modelBuilder.Entity<WriteOffRequest>().Property(r => r.Quantity).HasColumnType("numeric(12,3)");
    }
}