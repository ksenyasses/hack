import { useEffect, useState } from "react";
import {
  getProducts, getStock, getBatches, createWriteoff, getWriteoffHistory,
  WRITE_OFF_REASONS,
} from "./api";
import type {
  Product, StockItem, BatchItem, Movement, WriteOffReason,
} from "./api";

// Стили — по макету design/повар списание.html
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0; color: #1f2b38; }
.page-sub { font-size: 13.5px; color: #7b8794; margin: 7px 0 0;
            max-width: 760px; line-height: 1.5; }
.kpi-row { display: grid; grid-template-columns: repeat(2, 1fr);
           gap: 16px; margin: 20px 0 18px; }
.kpi { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
       padding: 16px 18px; display: flex; align-items: center; gap: 14px; }
.kpi .badge { width: 44px; height: 44px; border-radius: 10px; flex: 0 0 44px;
              display: flex; align-items: center; justify-content: center;
              font-size: 20px; font-weight: 800; }
.kpi .val { font-size: 24px; font-weight: 700; line-height: 1; color: #1f2b38; }
.kpi .lbl { font-size: 12.5px; color: #7b8794; margin-top: 5px; }
.b-red { background: #fbe9e8; color: #d0342c; }
.b-amber { background: #fdf1dd; color: #e0902a; }
.cols { display: grid; grid-template-columns: 400px 1fr; gap: 16px; align-items: start; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px; padding: 20px 22px; }
.card-title { font-size: 15px; font-weight: 700; color: #1f2b38; margin: 0 0 16px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12.5px; color: #7b8794; margin-bottom: 6px; }
.field select, .field input { width: 100%; height: 40px; padding: 0 12px; font-size: 14px;
  color: #1f2b38; background: #fff; border: 1px solid #d6dbdf;
  border-radius: 6px; outline: none; }
.field input:focus, .field select:focus { border-color: #2e7fb5;
  box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn-write { width: 100%; height: 44px; margin-top: 4px; font-size: 15px;
  font-weight: 700; color: #fff; background: #d0342c;
  border: none; border-radius: 6px; cursor: pointer; }
.btn-write:hover { background: #b52b24; }
.btn-write:disabled { opacity: 0.7; cursor: default; }
.hint { margin: 14px 0 0; padding: 11px 13px; font-size: 12.5px; line-height: 1.5;
        color: #7b8794; background: #f6f7f8; border: 1px solid #e8ebed; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 12px 14px;
            font-size: 13px; font-weight: 700; color: #344054; }
.table td { padding: 13px 14px; border-top: 1px solid #eef0f3;
            font-size: 13.5px; color: #4b5563; }
.name { font-weight: 600; color: #1f2b38; }
.qty { font-weight: 700; color: #1f2b38; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 3px 9px;
        border-radius: 999px; background: #eef1f5; color: #5a6675; }
.chip-expiry { background: #fbe9e8; color: #d0342c; }
.empty { color: #7b8794; font-size: 13.5px; padding: 8px 0 2px; }
.msg { padding: 11px 13px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
.msg-ok { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.msg-err { background: #fdeaea; color: #d0342c; border: 1px solid #f6c9c7; }
`;

// "2026-10-08" -> "08.10"
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}`;
}

// 6.37 -> "6,370"
function fmtQty(q: number): string {
  return q.toFixed(3).replace(".", ",");
}

// "сегодня, 15:20" или "09.10, 18:40"
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (d.toDateString() === new Date().toDateString()) return `сегодня, ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mo}, ${hh}:${mm}`;
}

// Подпись причины по значению enum: "Expiry" -> "Просрочка"
function reasonLabel(value: string | null): string {
  const found = WRITE_OFF_REASONS.find((r) => r.value === value);
  return found ? found.label : (value ?? "");
}

// Раздел «Списание» — повар списывает испорченное и просроченное
export default function WriteOffPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [productId, setProductId] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<WriteOffReason>("Expiry");

  // Грузим всё разом: справочник, остатки, партии и историю
  const load = async () => {
    setLoading(true);
    try {
      const [p, s, b, h] = await Promise.all([
        getProducts(), getStock(), getBatches(), getWriteoffHistory(50),
      ]);
      setProducts(p);
      setStock(s);
      setBatches(b);
      setHistory(h);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Счётчики: getDashboard повару недоступен (403) — считаем сами
  const expiredQty = stock
    .filter((s) => s.status === "Просрочен")
    .reduce((sum, s) => sum + s.quantity, 0);
  const soonCount = batches.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 3).length;

  // Выбранный продукт и его партии по FEFO — по возрастанию срока
  const selectedId = Number(productId);
  const selected = products.find((p) => p.id === selectedId);
  const selectedStock = stock.find((s) => s.id === selectedId);
  const fefo = batches
    .filter((b) => b.productId === selectedId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const submit = async () => {
    setError("");
    setSuccess("");

    if (!productId) {
      setError("Выберите продукт");
      return;
    }
    // Запятая вместо точки: в БД numeric(12,3), number-инпут запятую не примет
    const q = Number(qtyText.replace(",", ".").trim());
    if (!qtyText.trim() || !Number.isFinite(q) || q <= 0) {
      setError("Количество должно быть больше нуля");
      return;
    }

    setSending(true);
    try {
      await createWriteoff(selectedId, Number(q.toFixed(3)), reason);
      setSuccess("Списано");
      setQtyText("");
      await load(); // обновляем остатки и историю
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось списать");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Списание</h1>
      <p className="page-sub">
        Списываем испорченное и просроченное. Партии выбираются автоматически
        по FEFO: сначала та, у которой срок ближе всего, просроченная уходит первой.
      </p>

      <div className="kpi-row">
        <div className="kpi">
          <span className="badge b-red">!</span>
          <div>
            <div className="val">{fmtQty(expiredQty)}</div>
            <div className="lbl">Просрочено — ждёт списания</div>
          </div>
        </div>
        <div className="kpi">
          <span className="badge b-amber">{soonCount}</span>
          <div>
            <div className="val">{soonCount} партий</div>
            <div className="lbl">Скоро истекают — до 3 дней</div>
          </div>
        </div>
      </div>

      <div className="cols">
        {/* Левая колонка — форма списания */}
        <div className="card">
          <h2 className="card-title">Новое списание</h2>

          {error && <div className="msg msg-err">{error}</div>}
          {success && <div className="msg msg-ok">{success}</div>}

          <div className="field">
            <label>Продукт</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— выберите —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Количество</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,000"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Причина</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as WriteOffReason)}
            >
              {WRITE_OFF_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-write" onClick={submit} disabled={loading || sending}>
            {sending ? "Списываем…" : "Списать"}
          </button>

          {selected && (
            <p className="hint">
              Остаток: <b>{fmtQty(selectedStock?.quantity ?? 0)} {selected.unit}</b>.
              {fefo.length > 0
                ? ` Списание пойдёт по FEFO: сначала партия со сроком ${fmtDate(fefo[0].expiryDate)}${fefo[1] ? `, затем ${fmtDate(fefo[1].expiryDate)}` : ""}.`
                : " Нет партий — списать нечего."}
            </p>
          )}
        </div>

        {/* Правая колонка — история списаний */}
        <div className="card">
          <h2 className="card-title">Последние списания</h2>

          {loading ? (
            <p className="empty">Загрузка…</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Продукт</th>
                  <th>Количество</th>
                  <th>Причина</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td className="empty" colSpan={4}>
                      Списаний пока нет
                    </td>
                  </tr>
                )}
                {history.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtWhen(m.createdAt)}</td>
                    <td className="name">{m.productName}</td>
                    {/* В журнале количество отрицательное — показываем модуль */}
                    <td className="qty">{fmtQty(Math.abs(m.quantityDelta))}</td>
                    <td>
                      <span className={m.reason === "Expiry" ? "chip chip-expiry" : "chip"}>
                        {reasonLabel(m.reason)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="empty">
            Показаны последние операции. Полный журнал — в разделе «Журнал».
          </p>
        </div>
      </div>
    </div>
  );
}