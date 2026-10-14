import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getProducts, createDelivery } from "./api";
import type { Product, DeliveryBatch } from "./api";
import ComboBox from "./ComboBox";
import { fmtQty, daysLeftText } from "./format";

// Стили раздела — по макету design/повар приёмка.jpg
const css = `
.page-title { margin: 0 0 20px; font-size: 28px; font-weight: 800; color: #344054; }
.form-card { background: #fff; border: 1px solid #e5e8ec; border-radius: 8px;
             padding: 24px; margin-bottom: 20px; max-width: 900px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-label { font-size: 13px; color: #7c8896; }
.hint { font-size: 12px; color: #9aa4af; font-style: italic; }
/* Метка «с упаковки» — чтобы было видно, откуда берётся дата */
.req {
  margin-left: 6px; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; font-style: normal;
  color: #b45309; background: #fef3c7;
}
.input, .select { height: 42px; padding: 0 14px; font-size: 15px; color: #2b3440;
                  border: 1px solid #d6dbdf; border-radius: 6px; outline: none;
                  background: #fff; }
.input:focus, .select:focus { border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.rows-labels { display: flex; gap: 12px; margin: 20px 0 8px; font-size: 13px; color: #7c8896; }
.row { display: flex; gap: 12px; margin-bottom: 10px; align-items: center; }
.row .select { flex: 2; }
.row .input { flex: 1; }
.row-date { width: 180px; }
.btn-remove { background: #fdeaea; color: #d0342c; border: none; border-radius: 6px;
              padding: 10px 14px; font-size: 14px; cursor: pointer; white-space: nowrap; }
.btn-remove:hover { background: #f9d7d7; }
.btn-add { background: #eef1f4; color: #344054; border: none; border-radius: 6px;
           padding: 11px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
.btn-add:hover { background: #e2e7ec; }
.actions { display: flex; gap: 12px; }
.btn-submit { background: #2f9e63; color: #fff; border: none; border-radius: 6px;
              padding: 13px 26px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-submit:hover:not(:disabled) { background: #278754; }
.btn-submit:disabled { opacity: 0.7; cursor: default; }
.btn-cancel { background: #eef1f4; color: #55606e; border: none; border-radius: 6px;
              padding: 13px 26px; font-size: 15px; cursor: pointer; }
.btn-cancel:hover { background: #e2e7ec; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
.success { color: #2f9e63; font-size: 15px; font-weight: 700; margin: 0 0 16px; }
.loading { color: #8a94a0; font-size: 16px; }
.table { width: 100%; border-collapse: collapse; background: #fff;
         border: 1px solid #e6e9ed; border-radius: 8px; overflow: hidden; max-width: 900px; }
.table th { background: #f5f7f8; text-align: left; padding: 13px 16px;
            font-size: 14px; font-weight: 700; color: #344054; }
.table td { padding: 15px 16px; border-top: 1px solid #eef0f3; font-size: 15px; color: #4b5563; }
.overdue { color: #b42318; font-weight: 700; }
.status { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.section-title { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #344054; }
`;

// Цвета статусов — как в разделе «Склад»
const STATUS_COLORS: Record<string, string> = {
  "Просрочен": "#d0342c",
  "Скоро истекает": "#e08b1a",
  "Годен": "#2f9e63",
  "Закончился": "#8a94a0",
};

// Цветной значок статуса: точка + текст
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#8a94a0";
  return (
    <span className="status" style={{ color }}>
      <span className="dot" style={{ background: color }} />
      {status.toLowerCase()}
    </span>
  );
}

// Дата из "2026-10-12" в "12.10.2026"
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// Достаём текст ошибки: ответ сервера → message → запасной
function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error ?? e.message ?? fallback;
}

// Одна строка поставки в форме
type Row = { productId: string; quantity: string; expiryDate: string };

const emptyRow: Row = { productId: "", quantity: "", expiryDate: "" };

// Раздел «Приёмка»: оформление поставки и созданные партии
export default function DeliveryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [number, setNumber] = useState("");
  const [comment, setComment] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // При открытии — грузим список продуктов для выпадающих списков
  useEffect(() => {
    (async () => {
      try {
        setProducts(await getProducts());
      } catch (err) {
        setError(errorText(err, "Не удалось загрузить продукты"));
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  // Добавить/удалить строку
  const addRow = () => setRows([...rows, { ...emptyRow }]);
  const removeRow = (index: number) => {
    if (rows.length === 1) return; // одна строка всегда должна быть
    setRows(rows.filter((_, i) => i !== index));
  };
  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  // Подсказки поля продукта — тот же набор для каждой строки приёмки
  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: p.name,
    hint: p.unit,
  }));

  // Сброс формы
  const reset = () => {
    setNumber("");
    setComment("");
    setRows([{ ...emptyRow }]);
  };

  // Оформление поставки
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Срок годности обязателен в каждой строке: он берётся с упаковки,
    // а не высчитывается по справочнику — иначе партия молча уедет
    // с чужим сроком и вовремя не попадёт ни в стоп-лист, ни в горячие.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) {
        setError(`Строка ${i + 1}: выберите продукт`);
        return;
      }
      if (!r.quantity.trim() || Number(r.quantity) <= 0) {
        setError(`Строка ${i + 1}: укажите количество`);
        return;
      }
      if (!r.expiryDate) {
        setError(`Строка ${i + 1}: укажите срок годности с упаковки`);
        return;
      }
    }

    setSending(true);
    try {
      const delivery = await createDelivery({
        number: number.trim(),
        comment: comment.trim() || undefined,
        items: rows.map((r) => ({
          productId: Number(r.productId),
          quantity: Number(r.quantity),
          expiryDate: r.expiryDate,
        })),
      });
      setSuccess(`Поставка ${delivery.number} оформлена`);
      setBatches(delivery.batches);
      reset();
    } catch (err) {
      setError(errorText(err, "Не удалось оформить поставку"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <style>{css}</style>
      <h1 className="page-title">Новая приёмка</h1>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label">Номер поставки</span>
          <input
            className="input"
            placeholder="П-2001"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">Комментарий (необязательно)</span>
          <input
            className="input"
            placeholder="Поставка от ООО «Мясо»"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="rows-labels">
          <span style={{ flex: 2 }}>Продукт</span>
          <span style={{ flex: 1 }}>Количество</span>
          <span className="row-date">
            Срок годности <span className="req">с упаковки</span>
          </span>
          <span />
        </div>

        {loadingProducts ? (
          <p className="loading">Загрузка продуктов…</p>
        ) : (
          rows.map((row, index) => (
            <div className="row" key={index}>
              <ComboBox
                options={productOptions}
                value={row.productId}
                onChange={(v) => updateRow(index, { productId: v })}
                placeholder="Начните вводить название"
              />
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
              />
              <input
                className="input row-date"
                type="date"
                value={row.expiryDate}
                onChange={(e) => updateRow(index, { expiryDate: e.target.value })}
              />
              <button type="button" className="btn-remove" onClick={() => removeRow(index)}>
                Удалить
              </button>
            </div>
          ))
        )}

        <button type="button" className="btn-add" onClick={addRow}>
          + Добавить строку
        </button>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn-submit" disabled={sending}>
            {sending ? "Отправка…" : "Оформить поставку"}
          </button>
          <button
            type="button"
            className="btn-cancel"
            onClick={() => { reset(); setError(""); setSuccess(""); }}
          >
            Отмена
          </button>
        </div>
      </form>

      {success && (
        <>
          <p className="success">✔ {success}</p>
          <h2 className="section-title">Созданные партии</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Количество</th>
                <th>Срок годности</th>
                <th>Дней до срока</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.productName}</td>
                  <td>{fmtQty(b.quantity)}</td>
                  <td>{formatDate(b.expiryDate)}</td>
                  <td className={b.daysLeft < 0 ? "overdue" : undefined}>
                    {daysLeftText(b.daysLeft)}
                  </td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}