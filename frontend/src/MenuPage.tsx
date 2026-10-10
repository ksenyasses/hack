import { useEffect, useState } from "react";
import { getDishes } from "./api";
import type { Dish } from "./api";

// Стили секций и карточек — по макету design/официант меню.jpg,
// цвета каркаса оставляет Layout.tsx, здесь только контент
const css = `
.page-title { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #344054; }
.section-label { display: flex; align-items: center; gap: 9px; margin: 24px 0 12px;
                 font-size: 14px; font-weight: 800; letter-spacing: 0.5px; }
.dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 11px; }
.label-ok { color: #2f9e63; }
.dot-ok { background: #2f9e63; }
.label-stop { color: #d0342c; }
.dot-stop { background: #d0342c; }
.card { position: relative; background: #fff; border: 1px solid #e6e9ee;
        border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; }
.card.off { background: #f7f8fa; }
.dish-name { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #1f2b38; }
.card.off .dish-name { color: #7b8794; }
.avail { font-size: 14px; font-weight: 600; color: #2f9e63; }
.avail-none { font-size: 14px; font-weight: 600; color: #7b8794; }
.reason { margin: 8px 0 0; font-size: 13px; color: #d0342c; }
.badge { position: absolute; top: 14px; right: 16px;
         font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 6px; }
.badge-promo { background: #e4692a; color: #fff; }
.badge-stop { background: #eef1f5; color: #5a6675; }
.loading { color: #7b8794; font-size: 16px; }
.error { color: #d0342c; font-size: 14px; }
.empty { color: #7b8794; font-size: 15px; }
`;

// Склонение: «1 порция», «2 порции», «5 порций»
function portionsWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (last === 1 && abs !== 11) return "порция";
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return "порции";
  return "порций";
}

// Доступно ли блюдо гостю прямо сейчас
function isAvailable(d: Dish): boolean {
  return !d.inStopList && d.availablePortions > 0;
}

// Раздел «Меню» для официанта: что можно приготовить и почему чего-то нет
export default function MenuPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // При открытии грузим блюда
  useEffect(() => {
    (async () => {
      try {
        setDishes(await getDishes());
      } catch (err) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить меню");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Сортировка: сначала «Блюдо дня», потом обычные доступные
  const available = dishes
    .filter(isAvailable)
    .sort((a, b) => Number(b.isPromo) - Number(a.isPromo));
  const stopped = dishes.filter((d) => !isAvailable(d));

  // Строка доступности: 0 порций — «Нет в наличии»
  const availText = (d: Dish) =>
    d.availablePortions === 0
      ? "Нет в наличии"
      : `Доступно: ${d.availablePortions} ${portionsWord(d.availablePortions)}`;

  return (
    <div>
      <style>{css}</style>
      <h1 className="page-title">Меню</h1>

      {loading && <p className="loading">Загрузка...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          {/* Доступные блюда */}
          <div className="section-label label-ok">
            <span className="dot dot-ok" />
            ДОСТУПНЫ
          </div>
          {available.length === 0 && <p className="empty">Нет доступных блюд</p>}
          {available.map((d) => (
            <div className="card" key={d.id}>
              {d.isPromo && <span className="badge badge-promo">Блюдо дня</span>}
              <h3 className="dish-name">{d.name}</h3>
              <span className="avail">{availText(d)}</span>
            </div>
          ))}

          {/* Стоп-лист */}
          <div className="section-label label-stop">
            <span className="dot dot-stop" />
            СТОП-ЛИСТ
          </div>
          {stopped.length === 0 && <p className="empty">Пусто — всё есть в наличии</p>}
          {stopped.map((d) => (
            <div className="card off" key={d.id}>
              <span className="badge badge-stop">Стоп-лист</span>
              <h3 className="dish-name">{d.name}</h3>
              <span className="avail-none">{availText(d)}</span>
              {d.reason && <p className="reason">Причина: {d.reason}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}