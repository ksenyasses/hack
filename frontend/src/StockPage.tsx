import { useEffect, useState } from "react";
import { getStock, getBatches } from "./api";
import type { StockItem, BatchItem } from "./api";

// Стили раздела — по макету design/повар склад.jpg
const css = `
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: #344054; }
.btn-refresh { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
               padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-refresh:hover:not(:disabled) { background: #276f9f; }
.btn-refresh:disabled { opacity: 0.7; cursor: default; }
.toggle { display: inline-flex; gap: 0; margin-bottom: 16px;
          background: #fff; border: 1px solid #e5e8ec; border-radius: 8px; overflow: hidden; }
.toggle-btn { padding: 10px 22px; font-size: 14px; font-weight: 600; color: #55606e;
              background: #fff; border: none; cursor: pointer; }
.toggle-btn:hover { background: #f4f6f8; }
.toggle-btn.active { background: #2e7fb5; color: #fff; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
.loading { color: #8a94a0; font-size: 16px; }
.table { width: 100%; border-collapse: collapse; background: #fff;
         border: 1px solid #e6e9ed; border-radius: 8px; overflow: hidden; }
.table th { background: #f5f7f8; text-align: left; padding: 13px 16px;
            font-size: 14px; font-weight: 700; color: #344054; }
.table td { padding: 15px 16px; border-top: 1px solid #eef0f3; font-size: 15px; color: #4b5563; }
.table tbody tr:hover td { background: #f8fafb; }
.low { color: #d0342c; font-weight: 700; }
.status { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.empty { padding: 20px 16px; color: #8a94a0; }
`;

// Цвета статусов — из задания
const STATUS_COLORS: Record<string, string> = {
  "Просрочен": "#d0342c",
  "Скоро истекает": "#e08b1a",
  "Годен": "#2f9e63",
  "Закончился": "#8a94a0",
};

// Цвет статуса: неизвестный статус — серый
function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#8a94a0";
}

// Дата из "2026-10-12" в "12.10.2026"; null или пусто — прочерк
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// Цветной значок статуса: точка + текст
function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span className="status" style={{ color }}>
      <span className="dot" style={{ background: color }} />
      {status.toLowerCase()}
    </span>
  );
}

// Раздел «Склад»: остатки и партии
export default function StockPage() {
  // Какой вид открыт: "stock" — остатки, "batches" — партии
  const [tab, setTab] = useState<"stock" | "batches">("stock");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Загрузка обоих списков (пока — из заглушки)
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [stockData, batchesData] = await Promise.all([getStock(), getBatches()]);
      setStock(stockData);
      setBatches(batchesData);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить склад");
    } finally {
      setLoading(false);
    }
  };

  // При открытии раздела — один раз
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <style>{css}</style>
      <div className="page-head">
        <h1 className="page-title">Склад</h1>
        <button className="btn-refresh" onClick={load} disabled={loading}>
          {loading ? "Обновление…" : "Обновить"}
        </button>
      </div>

      <div className="toggle">
        <button
          className={tab === "stock" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => setTab("stock")}
        >
          Остатки
        </button>
        <button
          className={tab === "batches" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => setTab("batches")}
        >
          Партии
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : tab === "stock" ? (
        // --- Вид «Остатки»: сколько всего по каждому продукту ---
        <table className="table">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Единица</th>
              <th>Количество</th>
              <th>Ближайший срок</th>
              <th>Дней до срока</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 && (
              <tr>
                <td className="empty" colSpan={6}>
                  Данных пока нет
                </td>
              </tr>
            )}
            {stock.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.unit}</td>
                <td className={s.belowMinStock ? "low" : undefined}>
                  {s.quantity}
                </td>
                <td>{formatDate(s.nearestExpiry)}</td>
                <td>{s.daysLeft ?? "—"}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // --- Вид «Партии»: из каких поставок набралось ---
        <table className="table">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Количество</th>
              <th>Срок годности</th>
              <th>Дней до срока</th>
              <th>Номер поставки</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td className="empty" colSpan={5}>
                  Партий пока нет
                </td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.productName}</td>
                <td>{b.quantity}</td>
                <td>{formatDate(b.expiryDate)}</td>
                <td>{b.daysLeft}</td>
                <td>{b.deliveryNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}