using Flagman.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Flagman.Api.Data;

public static class DbSeeder
{
    // Заводит трёх пользователей, если в базе ещё никого нет
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Users.AnyAsync())
            return;

        db.Users.AddRange(
            new User { FullName = "Управляющий", Login = "manager", PasswordHash = BCrypt.Net.BCrypt.HashPassword("123"), Role = Role.Manager },
            new User { FullName = "Повар",       Login = "cook",    PasswordHash = BCrypt.Net.BCrypt.HashPassword("123"), Role = Role.Cook },
            new User { FullName = "Официант",    Login = "waiter",  PasswordHash = BCrypt.Net.BCrypt.HashPassword("123"), Role = Role.Waiter }
        );

        await db.SaveChangesAsync();
    }
}