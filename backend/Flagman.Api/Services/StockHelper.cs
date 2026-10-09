using Flagman.Api.Models;

namespace Flagman.Api.Services;

public static class StockHelper
{
    // Порог «скоро истекает» — 3 дня
    public const int ExpiringSoonDays = 3;

    // Сколько дней осталось до срока. Может быть отрицательным — значит просрочено
    public static int DaysLeft(DateOnly expiry)
        => expiry.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber;

    // Статус партии по сроку и остатку
    public static string Status(DateOnly expiry, decimal quantity)
    {
        if (quantity <= 0) return "Закончился";

        var days = DaysLeft(expiry);
        if (days < 0) return "Просрочен";
        if (days <= ExpiringSoonDays) return "Скоро истекает";
        return "Годен";
    }
}