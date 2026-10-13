import { useEffect, useRef, useState } from "react";
import {
  getProducts, getStock, getBatches, createWriteoffRequest,
  getWriteoffRequests, WRITE_OFF_REASONS,
} from "./api";
import type {
  Product, StockItem, BatchItem, WriteOffReason, WriteOffRequestItem,
} from "./api";

// Стили — по макету design/повар списание.html + карточка «К списанию»
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
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px; padding: 20px 22px; }
.card-title { font-size: 15px; font-weight: 700; color: #1f2b38; margin: 0 0 16px; }
.card-head { display: flex; align-items: center; justify-content: space-between;
             gap: 12px; margin-bottom: 6px; }
.card-head .card-title { margin: 0; }
.mb { margin-bottom: 18px; }
.cols { display: grid; grid-template-columns: 400px 1fr; gap: 16px; align-items: start; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12.5px; color: #7b8794; margin-bottom: 6px; }
.field select, .field input, .field textarea { width: 100%; height: 40px; padding: 0 12px;
  font-size: 14px; color: #1f2b38; background: #fff; border: 1px solid #d6dbdf;
  border-radius: 6px; outline: none; font-family: inherit; }
.field textarea { height: 70px; padding: 10px 12px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: #2e7fb5;
  box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn-write { width: 100%; height: 44px; margin-top: 4px; font-size: 14px;
  font-weight: 700; color: #fff; background: #e4692a;
  border: none; border-radius: 6px; cursor: pointer; }
.btn-write:hover:not(:disabled) { background: #cf5c20; }
.btn-write:disabled { opacity: 0.7; cursor: default; }
.btn-ghost { background: #fff; color: #2e7fb5; border: 1px solid #bcd6e6;
             border-radius: 6px; padding: 6px 12px; font-size: 12.5px;
             font-weight: 600; cursor: pointer; }
.btn-ghost:hover { background: #f0f6fa; }
.btn-all { background: #e4692a; color: #fff; border: none; border-radius: 8px;
           padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
           white-space: nowrap; }
.btn-all:hover { background: #cf5c20; }
.btn-all:disabled { opacity: 0.7; cursor: default; }
.hint { margin: 14px 0 0; padding: 11px 13px; font-size: 12.5px; line-height: 1.5;
        color: #7b8794; background: #f6f7f8; border: 1px solid #e8ebed; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 12px 14px;
            font-size: 13px; font-weight: 700; color: #344054; white-space: nowrap; }
.table td { padding: 13px 14px; border-top: 1px solid #eef0f3;
            font-size: 13.5px; color: #4b5563; vertical-align: middle; }
.table .name { font-weight: 600; color: #1f2b38; }
.qty { font-weight: 700; color: #1f2b38; }
.expiry { color: #d0342c; font-weight: 600; }
.overdue { color: #d0342c; font-weight: 600; white-space: nowrap; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 3px 9px;
        border-radius: 999px; background: #eef1f5; color: #5a6675; }
.chip-expiry { background: #fbe9e8; color: #d0342c; }
.comment { font-size: 12px; color: #7b8794; margin-top: 3px; }
.st { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px;
      border-radius: 999px; white-space: nowrap; }
.st-pending { background: #fdf1dd; color: #a5701f; }
.st-ok { background: #e9f7ef; color: #2f9e63; }
.st-rej { background: #eef1f5; color: #5a6675; }
.empty { color: #7b8794; font-size: 13.5px; padding: 8px 0 2px; }
.msg { padding: 11px 13px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
.msg-ok { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.msg-err { background: #fdeaea; color: #d0342c; border: 1px solid #f6c9c7; }
.msg-info { background: #e8f1f8; color: #2e7fb5; border: 1px solid #bcd6e6; }
.msg-inline { margin: 10px 0 0; }
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

// Плашка состояния заявки
function statusChip(status: string): string {
  if (status === "Pending") return "st st-pending";
  if (status === "Approved") return "st st-ok";
  return "st st-rej";
}

const STATUS_LABELS: Record<string, string> = {
  Pending: "Ожидает",
  Approved: "Подтверждена",
  Rejected: "Отклонена",
};

// Склонение: «1 день», «2 дня», «5 дней»
function daysWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (last === 1 && abs !== 11) return "день";
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return "дня";
  return "дней";
}

// Одна строка карточки «К списанию»: продукт + все его просроченные партии
type ExpiredGroup = {
  productId: number;
  productName: string;
  unit: string;
  quantity: number; // сумма по всем просроченным партиям продукта
  deliveries: string[]; // номера поставок
  dates: string[]; // сроки годности партий
  daysOverdue: number; // на сколько просрочено (берём самое большое)
};

// Раздел «Списание» — повар отправляет заявки, товар списывается после подтверждения
export default function WriteOffPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [requests, setRequests] = useState<WriteOffRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Состояние кнопки «Отправить всё на подтверждение»
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkOk, setBulkOk] = useState("");
  const [bulkErr, setBulkErr] = useState("");

  const [productId, setProductId] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<WriteOffReason>("Expiry");
  // Текст для причины «Другое» — обязателен, когда причина выбрана
  const [comment, setComment] = useState("");

  // Ссылка на карточку формы — после кнопки «Списать» в строке к ней скроллим
  const formRef = useRef<HTMLDivElement>(null);

  // Грузим всё разом: справочник, остатки, партии и свои заявки
  const load = async () => {
    setLoading(true);
    try {
      const [p, s, b, r] = await Promise.all([
        getProducts(), getStock(), getBatches(), getWriteoffRequests(),
      ]);
      setProducts(p);
      setStock(s);
      setBatches(b);
      setRequests(r);
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

  // Просроченные партии: daysLeft < 0 — срок уже вышел
  const expiredBatches = batches.filter((b) => b.daysLeft < 0);

  // Группируем по продукту: продукт в таблице один раз, количество — сумма
  const expiredGroups: ExpiredGroup[] = [];
  for (const b of expiredBatches) {
    const g = expiredGroups.find((x) => x.productId === b.productId);
    if (g) {
      g.quantity += b.quantity;
      g.deliveries.push(b.deliveryNumber);
      g.dates.push(b.expiryDate);
      g.daysOverdue = Math.max(g.daysOverdue, -b.daysLeft);
    } else {
      expiredGroups.push({
        productId: b.productId,
        productName: b.productName,
        unit: products.find((p) => p.id === b.productId)?.unit ?? "",
        quantity: b.quantity,
        deliveries: [b.deliveryNumber],
        dates: [b.expiryDate],
        daysOverdue: -b.daysLeft,
      });
    }
  }

  // Счётчик «Просрочено — ждёт списания» — по тем же данным, что и таблица
  const expiredQty = expiredGroups.reduce((sum, g) => sum + g.quantity, 0);
  const soonCount = batches.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 3).length;

  // Выбранный продукт и его партии по FEFO — по возрастанию срока
  const selectedId = Number(productId);
  const selected = products.find((p) => p.id === selectedId);
  const selectedStock = stock.find((s) => s.id === selectedId);
  const fefo = batches
    .filter((b) => b.productId === selectedId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  // Отправить заявку повара (товар пока НЕ списывается)
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
    // У причины «Другое» обязателен текст — иначе заявка бессмысленна
    if (reason === "Other" && !comment.trim()) {
      setError("Для причины „Другое“ напишите, что случилось");
      return;
    }

    setSending(true);
    try {
      await createWriteoffRequest(
        selectedId,
        Number(q.toFixed(3)),
        reason,
        comment.trim() || null
      );
      setSuccess("Заявка отправлена управляющему");
      setQtyText("");
      setComment("");
      await load(); // обновляем заявки
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось отправить заявку");
    } finally {
      setSending(false);
    }
  };

  // Кнопка «Списать» в строке: подставляем продукт, сумму и причину в форму
  const fillForm = (g: ExpiredGroup) => {
    setProductId(String(g.productId));
    setQtyText(fmtQty(g.quantity)); // запятая — форма её принимает
    setReason("Expiry");
    setComment("");
    setError("");
    setSuccess("");
    // Форма ниже — подскролливаем к ней, чтобы подстановка была видна
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // «Отправить всё на подтверждение»: идём по продуктам по очереди.
  // Ошибка на одном не прерывает цикл — собираем и показываем одной строкой.
  const writeOffAll = async () => {
    setBulkBusy(true);
    setBulkOk("");
    setBulkErr("");
    let done = 0;
    const fails: string[] = [];
    for (const g of expiredGroups) {
      try {
        await createWriteoffRequest(g.productId, Number(g.quantity.toFixed(3)), "Expiry", null);
        done += 1;
      } catch (err) {
        const e = err as { response?: { data?: { error?: string } }; message?: string };
        fails.push(`${g.productName}: ${e.response?.data?.error ?? e.message ?? "ошибка"}`);
      }
    }
    if (done > 0) setBulkOk(`Заявок отправлено: ${done}`);
    if (fails.length > 0) setBulkErr(fails.join(" · "));
    await load(); // пересчёт заявок
    setBulkBusy(false);
  };

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Списание</h1>
      <p className="page-sub">
        Списываем испорченное и просроченное. Заявка уходит управляющему —
        товар спишется только после его подтверждения. Партии сервер выбирает по FEFO.
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

      {/* Карточка «К списанию» — автоматически по просроченным партиям */}
      <div className="card mb">
        <div className="card-head">
          <h2 className="card-title">К списанию</h2>
          <button
            className="btn-all"
            onClick={writeOffAll}
            disabled={bulkBusy || expiredGroups.length === 0}
          >
            {bulkBusy ? "Отправляем…" : "Отправить всё на подтверждение"}
          </button>
        </div>

        {bulkOk && <div className="msg msg-info msg-inline">{bulkOk}</div>}
        {bulkErr && <div className="msg msg-err msg-inline">{bulkErr}</div>}

        {loading ? (
          <p className="empty">Загрузка…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Поставка</th>
                <th>Количество</th>
                <th>Срок</th>
                <th>Просрочено на</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expiredGroups.length === 0 && (
                <tr>
                  <td className="empty" colSpan={6}>
                    Просроченных партий нет
                  </td>
                </tr>
              )}
              {expiredGroups.map((g) => (
                <tr key={g.productId}>
                  <td className="name">{g.productName}</td>
                  <td>{g.deliveries.join(", ")}</td>
                  <td className="qty">
                    {fmtQty(g.quantity)} {g.unit}
                  </td>
                  <td className="expiry">{g.dates.map(fmtDate).join(", ")}</td>
                  <td className="overdue">
                    {g.daysOverdue} {daysWord(g.daysOverdue)}
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      onClick={() => fillForm(g)}
                      disabled={bulkBusy}
                    >
                      Списать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cols">
        {/* Левая колонка — форма заявки на списание */}
        <div className="card" ref={formRef}>
          <h2 className="card-title">Новое списание</h2>

          {error && <div className="msg msg-err">{error}</div>}
          {success && <div className="msg msg-info">{success}</div>}

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

          {/* Для причины «Другое» — обязательное поле с описанием */}
          {reason === "Other" && (
            <div className="field">
              <label>Что случилось</label>
              <textarea
                placeholder="Опишите, почему продукт списывается"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}

          <button className="btn-write" onClick={submit} disabled={loading || sending}>
            {sending ? "Отправляем…" : "Отправить на подтверждение"}
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

        {/* Правая колонка — свои заявки */}
        <div className="card">
          <h2 className="card-title">Мои заявки</h2>

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
                  <th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td className="empty" colSpan={5}>
                      Заявок пока нет
                    </td>
                  </tr>
                )}
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtWhen(r.createdAt)}</td>
                    <td className="name">{r.productName}</td>
                    <td className="qty">
                      {fmtQty(r.quantity)} {r.unit}
                    </td>
                    <td>
                      <span className={r.reason === "Expiry" ? "chip chip-expiry" : "chip"}>
                        {reasonLabel(r.reason)}
                      </span>
                      {/* Текст «Что случилось» — мелким серым под причиной */}
                      {r.comment && <div className="comment">{r.comment}</div>}
                    </td>
                    <td>
                      <span className={statusChip(r.status)}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="empty">
            Статус меняет управляющий. Товар спишется только после подтверждения.
          </p>
        </div>
      </div>
    </div>
  );
}