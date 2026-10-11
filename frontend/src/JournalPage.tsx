import { useEffect, useState } from "react";
import { getMovements, getProducts, WRITE_OFF_REASONS } from "./api";
import type { Movement, MovementType, Product } from "./api";

// Стили — по макету design/журнал операций.jpg, таблица как в StockPage.tsx
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #1f2b38; }
.filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.filter { display: flex; flex-direction: column; gap: 5px; }
.filter label { font-size: 12px; color: #7b8794; }
.filter select, .filter input { height: 38px; min-width: 170px; padding: 0 10px;
  font-size: 13.5px; color: #1f2b38; background: #fff;
  border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.filter select:focus, .filter input:focus { border-color: #2e7fb5;
  box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px; padding: 18px 20px; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 12px 14px;
            font-size: 13px; font-weight: 700; color: #344054; white-space: nowrap; }
.table td { padding: 12px 14px; border-top: 1px solid #eef0f3;
            font-size: 13.5px; color: #4b5563; white-space: nowrap; }
.name { font-weight: 600; color: #1f2b38; }
.plus { font-weight: 700; color: #2f9e63; }
.minus { font-weight: 700; color: #d0342c; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 3px 9px;
        border-radius: 999px; background: #eef1f5; color: #5a6675; }
.chip-receipt { background: #e9f7ef; color: #2f9e63; }
.chip-order { background: #e8f1f8; color: #2e7fb5; }
.chip-writeoff { background: #fbe9e8; color: #d0342c; }
.muted { color: #7b8794; }
.date { color: #4b5563; }
.expiry { color: #d0342c; font-weight: 600; }
.empty { color: #7b8794; font-size: 14px; padding: 16px 4px; }
.loading { color: #7b8794; font-size: 16px; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
.note { margin: 14px 0 0; font-size: 12.5px; color: #7b8794; line-height: 1.5; }
`;

// Тип операции — как в бэкенде, подпись как в макете
const TYPE_LABELS: Record<MovementType, string> = {
  Receipt: "Приёмка",
  Order: "Продажа",
  WriteOff: "Списание",
};

function typeChip(t: string): string {
  if (t === "Receipt") return "chip chip-receipt";
  if (t === "Order") return "chip chip-order";
  return "chip chip-writeoff";
}

// "2026-10-08" -> "08.10"; у пустой даты — прочерк
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}`;
}

// "14:22"
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "+3,000" или "−0,750"
function changeText(delta: number): string {
  const sign = delta > 0 ? "+" : "−";
  return sign + Math.abs(delta).toFixed(3).replace(".", ",");
}

// Комментарий строки: у списания — причина, у продажи — номер заказа
function commentOf(m: Movement): string {
  if (m.reason) {
    const found = WRITE_OFF_REASONS.find((r) => r.value === m.reason);
    return found ? found.label : m.reason;
  }
  if (m.orderId != null) return `Заказ №${m.orderId}`;
  return "—";
}

// Раздел «Журнал операций»
export default function JournalPage() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [type, setType] = useState<MovementType | "">("");
  const [productId, setProductId] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Справочник продуктов — нужен и для списка фильтра, и для единиц измерения
  useEffect(() => {
    getProducts().then(setProducts).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Три фильтра уходят на сервер; productName — только для заглушки
      const picked = products.find((p) => String(p.id) === productId);
      setRows(
        await getMovements({
          type: type || undefined,
          productId: productId ? Number(productId) : undefined,
          productName: picked?.name,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        })
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить журнал");
    } finally {
      setLoading(false);
    }
  };

  // Перезагрузка при смене любого серверного фильтра
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, productId, from, to]);

  // Фильтр по пользователю — только на клиенте (бэк его не умеет)
  const shown = user ? rows.filter((r) => r.userName === user) : rows;

  // Список пользователей — из уже загруженных строк
  const users = Array.from(new Set(rows.map((r) => r.userName).filter(Boolean)));

  // Единица измерения подставляется по названию продукта
  const unitOf = (name: string) => products.find((p) => p.name === name)?.unit ?? "";

  // Сегодняшняя дата: срок партии в прошлом подсвечиваем красным
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Журнал операций</h1>

      <div className="filters">
        <div className="filter">
          <label>Тип</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MovementType | "")}
          >
            <option value="">все</option>
            <option value="Receipt">Приёмка</option>
            <option value="Order">Продажа</option>
            <option value="WriteOff">Списание</option>
          </select>
        </div>

        <div className="filter">
          <label>Продукт</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">все</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Пользователь</label>
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">все</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="filter">
          <label>Дата с</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>

        <div className="filter">
          <label>Дата по</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        {loading ? (
          <p className="loading">Загрузка…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Операция</th>
                <th>Продукт</th>
                <th>Изменение</th>
                <th>Срок партии</th>
                <th>Кто</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    Операций не найдено
                  </td>
                </tr>
              )}
              {shown.map((m) => (
                <tr key={m.id}>
                  <td>{fmtTime(m.createdAt)}</td>
                  <td>
                    <span className={typeChip(m.type)}>
                      {TYPE_LABELS[m.type as MovementType] ?? m.type}
                    </span>
                  </td>
                  <td className="name">
                    {m.productName} <span className="muted">{unitOf(m.productName)}</span>
                  </td>
                  <td className={m.quantityDelta > 0 ? "plus" : "minus"}>
                    {changeText(m.quantityDelta)}
                  </td>
                  <td
                    className={
                      !m.batchExpiry
                        ? "muted"
                        : m.batchExpiry.slice(0, 10) < today
                          ? "expiry"
                          : "date"
                    }
                  >
                    {fmtDate(m.batchExpiry)}
                  </td>
                  <td>{m.userName}</td>
                  <td className="muted">{commentOf(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="note">
          События стоп-листа в журнал не пишутся: стоп-лист считается на лету
          из остатков и сроков, отдельной записи в базе у него нет.
        </p>
      </div>
    </div>
  );
}