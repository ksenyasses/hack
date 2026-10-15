using Flagman.Api.Models;

namespace Flagman.Api.Services;

public static class StockHelper
{
    // Порог «скоро истекает» — 3 дня
    public const int ExpiringSoonDays = 3;

    // Сегодняшняя дата в местном времени кухни.
    //
    // Именно местное, а не UTC: в 00:30 по Москве UTC ещё вчера, и система
    // показывала бы «сегодня» для вчерашнего срока, а «завтра» — для
    // сегодняшнего. Повар вводит дату с упаковки по своему календарю,
    // значит и считать надо по нему.
    public static DateOnly Today() => DateOnly.FromDateTime(DateTime.Now);

    // Сколько дней осталось до срока. Может быть отрицательным — значит просрочено
    public static int DaysLeft(DateOnly expiry)
        => expiry.DayNumber - Today().DayNumber;

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