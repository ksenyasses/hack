// Единое место, где числа и дни превращаются в текст.
// Раньше в пяти страницах лежали копии одной и той же функции, и числа
// на разных экранах выглядели по-разному: «6,000» тут, «6» там.

/** «6» → «6»,  6.5 → «6,5»,  0.2 → «0,2»,  1.2345 → «1,234» */
export function fmtQty(q: number): string {
  if (!Number.isFinite(q)) return "0";
  // Меньше тысячной доли показываем явно, иначе получилось бы «0»
  if (q !== 0 && Math.abs(q) < 0.001) return "<0,001";

  const fixed = Math.abs(q).toFixed(3);
  const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  const body = trimmed === "" ? "0" : trimmed;
  return q < 0 ? "-" + body : body;
}

/** Русский падеж: 1 день, 2 дня, 5 дней */
export function dayWord(n: number): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const teens = abs % 100 >= 11 && abs % 100 <= 14;
  if (last === 1 && !teens) return "день";
  if (last >= 2 && last <= 4 && !teens) return "дня";
  return "дней";
}

/**
 * Сколько осталось до срока — словами, а не минусом.
 * Раньше в колонке «Дней до срока» для просроченного партия стояло «-2»,
 * что читается как ошибка, а не как просрочка.
 */
export function daysLeftText(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days < 0) return `просрочен ${-days} ${dayWord(days)}`;
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `${days} ${dayWord(days)}`;
}
