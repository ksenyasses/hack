import { useEffect, useState } from "react";
import { getStopList } from "./api";
import type { StopListItem } from "./api";

// Стили — по макету design/управляющий стоп-лист.jpg
const css = `
.page-head { display: flex; align-items: flex-start; justify-content: space-between;
             gap: 16px; margin-bottom: 18px; }
.page-title { font-size: 22px; font-weight: 700; margin: 0; color: #1f2b38; }
.page-sub { font-size: 13.5px; color: #7b8794; margin: 6px 0 0; }
.btn-refresh { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
               padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-refresh:hover:not(:disabled) { background: #276f9f; }
.btn-refresh:disabled { opacity: 0.7; cursor: default; }
.kpi { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
       padding: 16px 18px; display: flex; align-items: center; gap: 14px;
       margin-bottom: 18px; }
.kpi .badge { width: 44px; height: 44px; border-radius: 10px; flex: 0 0 44px;
              display: flex; align-items: center; justify-content: center;
              font-size: 22px; font-weight: 800;
              background: #fbe9e8; color: #d0342c; }
.kpi .val { font-size: 24px; font-weight: 700; line-height: 1; color: #1f2b38; }
.kpi .lbl { font-size: 12.5px; color: #7b8794; margin-top: 5px; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 13px 16px;
            font-size: 14px; font-weight: 700; color: #344054; }
.table td { padding: 14px 16px; border-top: 1px solid #eef0f3;
            font-size: 14.5px; color: #4b5563; }
.dish { font-weight: 600; color: #1f2b38; }
.reason { color: #d0342c; }
.empty { color: #7b8794; font-size: 15px; }
.loading { color: #7b8794; font-size: 16px; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
`;

// Склонение: «1 блюдо», «2 блюда», «5 блюд»
function dishesWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (last === 1 && abs !== 11) return "блюдо";
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return "блюда";
  return "блюд";
}

// Раздел «Стоп-лист»: блюда, которые сейчас нельзя продать
export default function StopListPage() {
  const [items, setItems] = useState<StopListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getStopList());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить стоп-лист");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <style>{css}</style>

      <div className="page-head">
        <div>
          <h1 className="page-title">Стоп-лист</h1>
          <p className="page-sub">Блюда, которые сейчас недоступны для продажи</p>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading}>
          {loading ? "Обновление…" : "Обновить"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="kpi">
        <span className="badge">!</span>
        <div>
          <div className="val">
            {items.length} {dishesWord(items.length)}
          </div>
          <div className="lbl">Сейчас в стоп-листе</div>
        </div>
      </div>

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Блюдо</th>
                <th>Причина</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="empty" colSpan={2}>
                    Стоп-лист пуст — все блюда доступны
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="dish">{it.name}</td>
                  <td className="reason">{it.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}