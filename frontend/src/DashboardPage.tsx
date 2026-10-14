import { useEffect, useState } from "react";
import { getDashboard, getHotOffers, setDishPromo } from "./api";
import type { DashboardData, HotOffer } from "./api";

// Стили — копия палитры из макета управляющий-дашборд-макет.html
const css = `
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #1f2b38; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
       padding: 16px 18px; display: flex; align-items: center; gap: 14px; }
.kpi .badge { width: 44px; height: 44px; border-radius: 10px; flex: 0 0 44px;
              display: flex; align-items: center; justify-content: center; font-size: 20px; }
.kpi .val { font-size: 24px; font-weight: 700; line-height: 1; color: #1f2b38; }
.kpi .lbl { font-size: 12.5px; color: #7b8794; margin-top: 5px; }
.b-blue { background: #e8f1f8; color: #2e7fb5; }
.b-red { background: #fbe9e8; color: #d0342c; }
.b-amber { background: #fdf1dd; color: #e0902a; }
.b-orange { background: #fdece2; color: #e4692a; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; }
.card-head { display: flex; align-items: center; justify-content: space-between;
             margin-bottom: 14px; }
.card-head .title { display: flex; align-items: center; gap: 9px;
                    font-size: 15px; font-weight: 700; color: #1f2b38; }
.hot { border: 1px solid #f3d3bd; border-left: 4px solid #e4692a;
       background: linear-gradient(180deg, #fffdfb 0%, #ffffff 60%);
       margin-bottom: 18px; }
.hot .flame { font-size: 18px; }
.hot .tagline { font-size: 12.5px; color: #7b8794; margin-top: 3px; }
.hot-summary { margin-left: auto; font-size: 12px; background: #fdf1dd;
               border: 1px solid #f3ddb6; color: #a5701f;
               padding: 4px 10px; border-radius: 999px; font-weight: 600; }
.hot-row { display: flex; align-items: center; gap: 14px;
           padding: 12px 0; border-top: 1px solid #e6e9ee; }
.hot-row:first-of-type { border-top: none; }
.hot-dish { font-size: 14px; font-weight: 600; min-width: 150px; color: #1f2b38; }
.hot-reason { font-size: 12.5px; color: #7b8794; flex: 1; }
.pill { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
        white-space: nowrap; }
.pill-high { background: #fbe9e8; color: #d0342c; }
.pill-mid { background: #fdf1dd; color: #a5701f; }
.pill-promo { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.hot-act { background: #e4692a; color: #fff; border: none; border-radius: 8px;
           padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
           white-space: nowrap; }
.hot-act:hover { background: #cf5c20; }
.hot-act.ghost { background: #fff; color: #e4692a; border: 1px solid #f0c3a4; }
.hot-act.ghost:hover { background: #fdf3ec; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
       padding: 10px 0; border-top: 1px solid #e6e9ee; }
.row:first-of-type { border-top: none; }
.row .name { font-size: 13.5px; font-weight: 600; color: #1f2b38; }
.row .meta { font-size: 12px; color: #7b8794; margin-top: 2px; }
.row .right { text-align: right; font-size: 12.5px; }
.qty { font-weight: 700; }
.warn { color: #d0342c; }
.chip { display: inline-block; font-size: 11.5px; padding: 3px 9px; border-radius: 999px;
        background: #eef1f5; color: #5a6675; }
.stop-chip { background: #fbe9e8; color: #d0342c; }
.empty-note { font-size: 12px; color: #7b8794; padding-top: 10px; }
.loading { color: #7b8794; font-size: 16px; }
.error { color: #d0342c; font-size: 14px; }
@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .grid3 { grid-template-columns: 1fr; }
}
`;

// «2026-10-10» → «10.10» для строки «срок 10.10»
function fmtDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

// «1 день», «2 дня», «5 дней» — склонение
function daysWord(n: number): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const last2 = abs % 100;
  let word = "дней";
  if (last === 1 && last2 !== 11) word = "день";
  else if (last >= 2 && last <= 4 && (last2 < 10 || last2 >= 20)) word = "дня";
  return `${n} ${word}`;
}

// Русский падеж для «блюдо»: 1 блюдо, 2 блюда, 5 блюд
function dishWord(n: number): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const teens = abs % 100 >= 11 && abs % 100 <= 14;
  if (last === 1 && !teens) return "блюдо";
  if (last >= 2 && last <= 4 && !teens) return "блюда";
  return "блюд";
}

// Четыре счётчика сверху — данные и подписи держим одним списком.
// Иконки не задаём: их рисует theme.css как контурные SVG по классу цвета,
// поэтому рядом с ними держать эмодзи не нужно.
const KPI_LABELS = [
  { cls: "b-blue", label: "Продуктов", key: "products" as const },
  { cls: "b-red", label: "Просрочено", key: "expired" as const },
  { cls: "b-amber", label: "В стоп-листе", key: "dishesInStopList" as const },
  { cls: "b-orange", label: "Скоро истекает", key: "expiringSoon" as const },
];

// Раздел «Дашборд»: счётчики, горячие предложения и три карточки
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [offers, setOffers] = useState<HotOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Грузим дашборд и предложения одним махом
  useEffect(() => {
    (async () => {
      try {
        const [dash, hot] = await Promise.all([getDashboard(), getHotOffers()]);
        setData(dash);
        setOffers(hot.offers);
      } catch (err) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить дашборд");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Кнопка «В акцию» / «Отменить»: включает или выключает «Блюдо дня»
  const togglePromo = async (offer: HotOffer) => {
    const today = new Date().toISOString().slice(0, 10); // "ГГГГ-ММ-ДД"
    const next = !offer.isPromo;
    try {
      await setDishPromo(offer.id, next ? today : null);
      // Статус сохранился — обновляем только эту строку
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, isPromo: next } : o))
      );
      setError("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось изменить акцию");
    }
  };

  return (
    <div>
      <style>{css}</style>
      <h1 className="page-title">Главная</h1>

      {loading && <p className="loading">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      {data && !loading && (
        <>
          {/* Четыре плитки-счётчика */}
          <div className="kpis">
            {KPI_LABELS.map((k) => (
              <div className="kpi" key={k.key}>
                <div className={`badge ${k.cls}`} aria-hidden="true" />
                <div>
                  <div className="val">{data.counters[k.key]}</div>
                  <div className="lbl">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Горячие предложения — оранжевая рамка */}
          <section className="card hot">
            <div className="card-head">
              <div>
                <div className="title">
                  <span className="flame">🔥</span> Горячие предложения
                  <span className="hot-summary">
                    {offers.length} {dishWord(offers.length)} сегодня
                  </span>
                </div>
                <div className="tagline">
                  Готовим и предлагаем гостям блюда, в которые уходят продукты с истекающим
                  сроком — меньше списаний.
                </div>
              </div>
            </div>

            {offers.map((offer, index) => (
              <div className="hot-row" key={offer.id}>
                <div className="hot-dish">{offer.name}</div>
                <div className="hot-reason">{offer.reason}</div>

                {offer.isPromo ? (
                  <>
                    <span className="pill pill-promo">Блюдо дня ✓</span>
                    <button className="hot-act ghost" onClick={() => togglePromo(offer)}>
                      Отменить
                    </button>
                  </>
                ) : (
                  <>
                    <span className={offer.priority >= 15 ? "pill pill-high" : "pill pill-mid"}>
                      {offer.priority >= 15 ? "Высокий" : "Средний"}
                    </span>
                    {index === 0 ? (
                      <button className="hot-act" onClick={() => togglePromo(offer)}>
                        В акцию
                      </button>
                    ) : (
                      <button className="hot-act ghost">Предложить</button>
                    )}
                  </>
                )}
              </div>
            ))}
            {offers.length === 0 && <div className="empty-note">Нет блюд под предложение</div>}
          </section>

          {/* Три карточки */}
          <div className="grid3">
            {/* Скоро истекает */}
            <section className="card">
              <div className="card-head">
                <div className="title">Скоро истекает</div>
              </div>
              {data.expiringSoon.map((it, i) => (
                <div className="row" key={i}>
                  <div>
                    <div className="name">{it.productName}</div>
                    <div className="meta">
                      срок {fmtDate(it.expiryDate)} · {daysWord(it.daysLeft)}
                    </div>
                  </div>
                  <div className="right">
                    <span className="qty">
                      {it.quantity.toFixed(2)} {it.unit}
                    </span>
                  </div>
                </div>
              ))}
              {data.expiringSoon.length === 0 && (
                <div className="empty-note">Всё в порядке</div>
              )}
            </section>

            {/* Заканчивается */}
            <section className="card">
              <div className="card-head">
                <div className="title">
                  Заканчивается <span className="chip">ниже минимума</span>
                </div>
              </div>
              {data.runningLow.map((it, i) => (
                <div className="row" key={i}>
                  <div>
                    <div className="name">{it.name}</div>
                    <div className="meta">
                      мин. остаток {it.minStock} {it.unit}
                    </div>
                  </div>
                  <div className="right">
                    <span className="qty warn">
                      {it.quantity.toFixed(2)} {it.unit}
                    </span>
                    <div className="meta">
                      не хватает {it.toOrder.toFixed(2)} {it.unit}
                    </div>
                  </div>
                </div>
              ))}
              <div className="empty-note">Оформите приёмку, чтобы пополнить запас.</div>
            </section>

            {/* Сейчас в стоп-листе */}
            <section className="card">
              <div className="card-head">
                <div className="title">Сейчас в стоп-листе</div>
              </div>
              {data.stopList.map((it) => (
                <div className="row" key={it.id}>
                  <div>
                    <div className="name">{it.name}</div>
                    <div className="meta">{it.reason}</div>
                  </div>
                  <div className="right">
                    <span className="chip stop-chip">Стоп</span>
                  </div>
                </div>
              ))}
              {data.stopList.length === 0 && <div className="empty-note">Пусто</div>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}