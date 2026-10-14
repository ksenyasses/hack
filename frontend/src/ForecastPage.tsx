import { useEffect, useState } from "react";
import { getPurchaseSuggestions, getStopListForecast } from "./api";
import type { ForecastData, ForecastRow, PurchaseSuggestion } from "./api";
import { fmtQty, dayWord } from "./format";

// Стили — в палитре остальных таблиц (StockPage / JournalPage)
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #1f2b38; }
.kpi-row { display: grid; grid-template-columns: repeat(2, 1fr);
           gap: 16px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
       padding: 16px 18px; display: flex; align-items: center; gap: 14px; }
.kpi .badge { width: 44px; height: 44px; border-radius: 10px; flex: 0 0 44px;
              display: flex; align-items: center; justify-content: center;
              font-size: 20px; font-weight: 800; }
.kpi .val { font-size: 24px; font-weight: 700; line-height: 1; color: #1f2b38; }
.kpi .lbl { font-size: 12.5px; color: #7b8794; margin-top: 5px; }
.b-blue { background: #e8f1f8; color: #2e7fb5; }
.b-amber { background: #fdf1dd; color: #e0902a; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; margin-bottom: 18px; }
.card-head { display: flex; align-items: center; justify-content: space-between;
             gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.card-title { font-size: 15px; font-weight: 700; color: #1f2b38; margin: 0; }
.period { display: flex; gap: 6px; }
.period button { background: #fff; color: #5a6675; border: 1px solid #d6dbdf;
                 border-radius: 6px; padding: 6px 14px; font-size: 12.5px;
                 font-weight: 600; cursor: pointer; }
.period button:hover { background: #f0f6fa; }
.period button.on { background: #2e7fb5; border-color: #2e7fb5; color: #fff; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 12px 14px;
            font-size: 13px; font-weight: 700; color: #344054; white-space: nowrap; }
.table td { padding: 12px 14px; border-top: 1px solid #eef0f3;
            font-size: 13.5px; color: #4b5563; }
.name { font-weight: 600; color: #1f2b38; }
.comment { font-size: 12px; color: #7b8794; margin-top: 2px; }
.qty { font-weight: 700; color: #1f2b38; white-space: nowrap; }
.order-col { font-weight: 700; color: #2e7fb5; white-space: nowrap; }
.reason { font-size: 12.5px; color: #7b8794; }
.muted { color: #7b8794; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px;
        border-radius: 999px; white-space: nowrap; }
.chip-stop { background: #fbe9e8; color: #d0342c; }
.chip-soon { background: #fdf1dd; color: #a5701f; }
.chip-ok { background: #e9f7ef; color: #2f9e63; }
.chip-nosales { background: #eef1f5; color: #5a6675; }
.empty { color: #7b8794; font-size: 13.5px; padding: 8px 0 2px; }
.loading { color: #7b8794; font-size: 16px; margin: 0 0 12px; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 12px; }
`;

// Плашка статуса блюда в прогнозе
function statusChip(status: string): string {
  if (status === "В стоп-листе") return "chip chip-stop";
  if (status === "Скоро закончится") return "chip chip-soon";
  if (status === "Работает") return "chip chip-ok";
  return "chip chip-nosales"; // "Нет продаж"
}

// Раздел «Прогноз и поставки» — что докупить и на сколько хватит блюд
export default function ForecastPage() {
  const [purchase, setPurchase] = useState<PurchaseSuggestion[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [days, setDays] = useState(7);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingF, setLoadingF] = useState(true);
  const [error, setError] = useState("");

  // Рекомендации по закупке — грузим один раз, период их не меняет
  useEffect(() => {
    getPurchaseSuggestions()
      .then(setPurchase)
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить рекомендации");
      })
      .finally(() => setLoadingP(false));
  }, []);

  // Прогноз — перезапрашиваем при смене периода
  useEffect(() => {
    setLoadingF(true);
    getStopListForecast(days)
      .then(setForecast)
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить прогноз");
      })
      .finally(() => setLoadingF(false));
  }, [days]);

  // Рекомендации — сначала самые объёмные: «Заказать» по убыванию
  const sorted = [...purchase].sort((a, b) => b.toOrder - a.toOrder);

  // Счётчик «блюд под риском» — из ответа сервера
  const atRisk = forecast?.atRisk ?? 0;

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Прогноз и поставки</h1>

      <div className="kpi-row">
        <div className="kpi">
          <span className="badge b-blue" aria-hidden="true" />
          <div>
            <div className="val">{purchase.length}</div>
            <div className="lbl">Продуктов докупить</div>
          </div>
        </div>
        <div className="kpi">
          <span className="badge b-amber" aria-hidden="true" />
          <div>
            <div className="val">{atRisk}</div>
            <div className="lbl">Блюд под риском</div>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Что заказать */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Что заказать</h2>
        </div>

        {loadingP ? (
          <p className="loading">Загрузка…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Остаток</th>
                <th>Минимум</th>
                <th>Заказать</th>
                <th>Причина</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td className="empty" colSpan={5}>
                    Докупать ничего не нужно
                  </td>
                </tr>
              )}
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td className="name">{p.name}</td>
                  <td className="qty">
                    {fmtQty(p.quantity)} {p.unit}
                  </td>
                  <td className="qty">
                    {fmtQty(p.minStock)} {p.unit}
                  </td>
                  <td className="order-col">
                    {fmtQty(p.toOrder)} {p.unit}
                  </td>
                  <td className="reason">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Прогноз по блюдам */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Прогноз по блюдам</h2>
          <div className="period">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={days === d ? "on" : ""}
                onClick={() => setDays(d)}
              >
                {d} дней
              </button>
            ))}
          </div>
        </div>

        {loadingF ? (
          <p className="loading">Загрузка…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Блюдо</th>
                <th>Порций</th>
                <th>Продано в день</th>
                <th>На сколько хватит</th>
                <th>Ограничивает</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {forecast?.dishes.length === 0 && (
                <tr>
                  <td className="empty" colSpan={6}>
                    Данных по блюдам пока нет
                  </td>
                </tr>
              )}
              {forecast?.dishes.map((row: ForecastRow) => (
                <tr key={row.dishId}>
                  <td>
                    <div className="name">{row.dishName}</div>
                    {/* Мелким серым — пояснение от сервера */}
                    <div className="comment">{row.comment}</div>
                  </td>
                  <td className="qty">{row.availablePortions}</td>
                  <td className="qty">
                    {String(row.portionsPerDay).replace(".", ",")}
                  </td>
                  <td className="qty">
                    {/* daysLeft === null — продаж по блюду не было */}
                    {row.daysLeft === null ? (
                      <span className="muted">нет продаж</span>
                    ) : (
                      `${row.daysLeft} ${dayWord(row.daysLeft)}`
                    )}
                  </td>
                  <td>{row.limitingProduct ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className={statusChip(row.status)}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}