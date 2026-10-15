import { useEffect, useState } from "react";
import { getOrdersArchive } from "./api";
import type { ArchiveOrder } from "./api";

// Раздел «Архив заказов» — что было выдано гостям.
// Журнал показывает движение товара, этот — движение заказов: кто готовил,
// кто подавал, в какой стол и когда. Фильтры как в журнале операций.

const css = `
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: #344054; }
.page-sub { margin: 7px 0 20px; font-size: 13.5px; color: #7b8794; max-width: 760px;
            line-height: 1.5; }

.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.filter { display: flex; flex-direction: column; gap: 5px; }
.filter label { font-size: 12px; color: #7c8896; }
.filter select, .filter input { height: 38px; min-width: 165px; padding: 0 10px;
                               font-size: 14px; color: #2b3440; background: #fff;
                               border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.filter select:focus, .filter input:focus { border-color: #0f766e;
                                             box-shadow: 0 0 0 3px rgba(15,118,110,0.12); }

.btn-reset { height: 38px; padding: 0 16px; font-size: 13px; font-weight: 600;
             color: #55606e; background: #eef1f4; border: none;
             border-radius: 6px; cursor: pointer; }
.btn-reset:hover { background: #e2e7ec; }

.table { width: 100%; border-collapse: collapse; background: #fff;
         border: 1px solid #e6e9ed; border-radius: 8px; overflow: hidden; }
.table th { background: #f5f7f8; text-align: left; padding: 13px 14px;
            font-size: 12px; font-weight: 700; color: #6b7683;
            text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
.table td { padding: 12px 14px; border-top: 1px solid #eef0f3;
            font-size: 14px; color: #3b4553; vertical-align: top; }
.table tbody tr:hover td { background: #f8fafb; }
.empty { color: #8a94a0; font-size: 15px; padding: 24px 0; }
.loading { color: #8a94a0; font-size: 16px; }
.error { color: #b42318; font-size: 14px; margin: 0 0 16px; }

.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.table-t { font-weight: 600; color: #1f2b38; }
.takeaway { color: #b45309; font-weight: 600; }
.dishes { color: #3b4553; line-height: 1.45; }
.who { color: #0f766e; font-weight: 600; }
.count { color: #8a94a0; font-size: 13px; white-space: nowrap; }
`;

// «15.10, 22:40» из ISO-строки
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = `${d.getDate()}`.padStart(2, "0") + "." + `${d.getMonth() + 1}`.padStart(2, "0");
  return `${day}, ${d.getHours()}`.padStart(5, "0") + `:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

export default function ArchivePage() {
  const [rows, setRows] = useState<ArchiveOrder[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(
        await getOrdersArchive({
          from: from || undefined,
          to: to || undefined,
          table: table.trim() || undefined,
          user: user || undefined,
        })
      );
      setError("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить архив");
    } finally {
      setLoading(false);
    }
  };

  // Любой фильтр меняется — перезапрашиваем
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, table, user]);

  const reset = () => {
    setFrom("");
    setTo("");
    setTable("");
    setUser("");
  };

  // Кого можно выбрать: собираем из уже загруженных строк
  const people = Array.from(
    new Set(rows.flatMap((r) => [r.cook, r.waiter].filter(Boolean) as string[]))
  ).sort();

  const totalPortions = rows.reduce((a, r) => a + r.dishCount, 0);

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Архив заказов</h1>
      <p className="page-sub">
        Что было выдано гостям. Заказ попадает сюда, когда официант нажимает
        «Выдан» на странице «Мои заказы».
      </p>

      <div className="filters">
        <div className="filter">
          <label>Дата с</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="filter">
          <label>Дата по</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="filter">
          <label>Стол</label>
          <input
            type="text"
            placeholder="любой"
            value={table}
            onChange={(e) => setTable(e.target.value)}
          />
        </div>
        <div className="filter">
          <label>Сотрудник</label>
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">все</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button className="btn-reset" onClick={reset}>Сбросить</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Загрузка…</p>}

      {!loading && rows.length === 0 && (
        <p className="empty">Выданных заказов по этим условиям нет</p>
      )}

      {!loading && rows.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Когда выдали</th>
                <th>Дата</th>
                <th>Стол</th>
                <th>Состав заказа</th>
                <th>Повар</th>
                <th>Официант</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.time ?? "—"}</td>
                  <td className="num">{fmtWhen(r.servedAt).split(",")[0]}</td>
                  <td>
                    {r.isTakeaway ? (
                      <span className="takeaway">Навынос</span>
                    ) : (
                      <span className="table-t">{r.tableNumber}</span>
                    )}
                  </td>
                  <td className="dishes">
                    {r.dishes}
                    <div className="count">{r.dishCount} порций · заказ №{r.id}</div>
                  </td>
                  <td className="who">{r.cook ?? "—"}</td>
                  <td className="who">{r.waiter ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="count" style={{ marginTop: 12 }}>
            Заказов: {rows.length} · порций: {totalPortions}
          </p>
        </>
      )}
    </div>
  );
}
