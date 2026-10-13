import { useEffect, useState } from "react";
import {
  getProducts, getWriteoffRequests, approveWriteoffRequest,
  rejectWriteoffRequest, createWriteoff, WRITE_OFF_REASONS,
} from "./api";
import type { Product, WriteOffReason, WriteOffRequestItem } from "./api";

// Стили — в палитре остальных страниц
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #1f2b38; }
.page-sub { font-size: 13.5px; color: #7b8794; margin: 0 0 16px;
            max-width: 780px; line-height: 1.5; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 700; color: #1f2b38; margin: 0 0 14px; }
.table { width: 100%; border-collapse: collapse; }
.table th { background: #f5f7f8; text-align: left; padding: 12px 14px;
            font-size: 13px; font-weight: 700; color: #344054; white-space: nowrap; }
.table td { padding: 12px 14px; border-top: 1px solid #eef0f3;
            font-size: 13.5px; color: #4b5563; vertical-align: middle; }
.name { font-weight: 600; color: #1f2b38; }
.qty { font-weight: 700; color: #1f2b38; white-space: nowrap; }
.comment { font-size: 12px; color: #7b8794; margin-top: 3px; }
.muted { color: #7b8794; }
.chip { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 3px 9px;
        border-radius: 999px; background: #eef1f5; color: #5a6675; }
.chip-expiry { background: #fbe9e8; color: #d0342c; }
.st { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 9px;
      border-radius: 999px; white-space: nowrap; }
.st-pending { background: #fdf1dd; color: #a5701f; }
.st-ok { background: #e9f7ef; color: #2f9e63; }
.st-rej { background: #eef1f5; color: #5a6675; }
.acts { display: flex; gap: 8px; }
.btn-ok { background: #2f9e63; color: #fff; border: none; border-radius: 6px;
          padding: 7px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.btn-ok:hover:not(:disabled) { background: #268052; }
.btn-no { background: #fff; color: #5a6675; border: 1px solid #d6dbdf; border-radius: 6px;
          padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.btn-no:hover:not(:disabled) { background: #f0f2f5; }
.btn-ok:disabled, .btn-no:disabled { opacity: 0.6; cursor: default; }
.form { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.f { display: flex; flex-direction: column; gap: 5px; }
.f label { font-size: 12px; color: #7b8794; }
.f select, .f input, .f textarea { height: 38px; min-width: 160px; padding: 0 10px;
  font-size: 13.5px; color: #1f2b38; background: #fff; border: 1px solid #d6dbdf;
  border-radius: 6px; outline: none; font-family: inherit; }
.f textarea { height: 38px; resize: none; }
.f select:focus, .f input:focus, .f textarea:focus { border-color: #2e7fb5;
  box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn-direct { background: #d0342c; color: #fff; border: none; border-radius: 6px;
              padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
.btn-direct:hover:not(:disabled) { background: #b52b24; }
.btn-direct:disabled { opacity: 0.7; cursor: default; }
.empty { color: #7b8794; font-size: 13.5px; padding: 8px 0 2px; }
.msg { padding: 11px 13px; border-radius: 8px; font-size: 13px; margin: 0 0 14px; }
.msg-ok { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.msg-err { background: #fdeaea; color: #d0342c; border: 1px solid #f6c9c7; }
`;

// 6.37 -> "6,370"
function fmtQty(q: number): string {
  return q.toFixed(3).replace(".", ",");
}

// "2026-10-13T09:40:00Z" -> "сегодня, 12:40"
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

// Раздел «Списания» — управляющий решает заявки повара
export default function WriteOffReviewPage() {
  const [requests, setRequests] = useState<WriteOffRequestItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // id заявки, по которой прямо сейчас жмут кнопку
  const [busyId, setBusyId] = useState<number | null>(null);

  // Форма «Списать сразу»
  const [productId, setProductId] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<WriteOffReason>("Expiry");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errForm, setErrForm] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await getWriteoffRequests());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  };

  // Заявки — при открытии; продукты — для формы прямого списания
  useEffect(() => {
    load();
    getProducts().then(setProducts).catch(() => {});
  }, []);

  // Ожидающие сверху, внутри — свежие первыми
  const sorted = [...requests].sort((a, b) => {
    if (a.status === "Pending" && b.status !== "Pending") return -1;
    if (b.status === "Pending" && a.status !== "Pending") return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Подтвердить: товар спишется на сервере, перечитываем заявки и справочник
  const approve = async (id: number) => {
    setBusyId(id);
    setError("");
    try {
      await approveWriteoffRequest(id);
      await load();
      setProducts(await getProducts());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось подтвердить заявку");
    } finally {
      setBusyId(null);
    }
  };

  // Отклонить: товар остаётся на складе
  const reject = async (id: number) => {
    setBusyId(id);
    setError("");
    try {
      await rejectWriteoffRequest(id);
      await load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось отклонить заявку");
    } finally {
      setBusyId(null);
    }
  };

  // Прямое списание мимо заявки — для срочных случаев
  const submitDirect = async () => {
    setErrForm("");
    setOkMsg("");
    if (!productId) {
      setErrForm("Выберите продукт");
      return;
    }
    const q = Number(qtyText.replace(",", ".").trim());
    if (!qtyText.trim() || !Number.isFinite(q) || q <= 0) {
      setErrForm("Количество должно быть больше нуля");
      return;
    }
    if (reason === "Other" && !comment.trim()) {
      setErrForm("Для причины „Другое“ напишите, что случилось");
      return;
    }

    setSending(true);
    try {
      await createWriteoff(Number(productId), Number(q.toFixed(3)), reason, comment.trim() || null);
      setOkMsg("Списано");
      setQtyText("");
      setComment("");
      await load(); // заявки могли зависнуть от остатков
      setProducts(await getProducts());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setErrForm(e.response?.data?.error ?? e.message ?? "Не удалось списать");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Списания</h1>
      <p className="page-sub">
        Заявки повара на списание. Склад меняется только после подтверждения —
        либо сразу, если списать срочно через форму ниже.
      </p>

      {error && <div className="msg msg-err">{error}</div>}

      {/* Заявки повара */}
      <div className="card">
        <h2 className="card-title">Заявки повара</h2>

        {loading ? (
          <p className="empty">Загрузка…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Количество</th>
                <th>Причина</th>
                <th>Кто</th>
                <th>Когда</th>
                <th>Состояние</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    Заявок нет
                  </td>
                </tr>
              )}
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="name">{r.productName}</td>
                  <td className="qty">
                    {fmtQty(r.quantity)} {r.unit}
                  </td>
                  <td>
                    <span className={r.reason === "Expiry" ? "chip chip-expiry" : "chip"}>
                      {reasonLabel(r.reason)}
                    </span>
                    {/* Текст «Что случилось» — серым рядом с причиной */}
                    {r.comment && <div className="comment">{r.comment}</div>}
                  </td>
                  <td>{r.createdBy}</td>
                  <td>{fmtWhen(r.createdAt)}</td>
                  <td>
                    <span className={statusChip(r.status)}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === "Pending" && (
                      <div className="acts">
                        <button
                          className="btn-ok"
                          onClick={() => approve(r.id)}
                          disabled={busyId === r.id}
                        >
                          Подтвердить
                        </button>
                        <button
                          className="btn-no"
                          onClick={() => reject(r.id)}
                          disabled={busyId === r.id}
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Списать сразу — та же логика, что у повара, но без заявки */}
      <div className="card">
        <h2 className="card-title">Списать сразу</h2>

        {okMsg && <div className="msg msg-ok">{okMsg}</div>}
        {errForm && <div className="msg msg-err">{errForm}</div>}

        <div className="form">
          <div className="f">
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

          <div className="f">
            <label>Количество</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,000"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
            />
          </div>

          <div className="f">
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

          {/* Причина «Другое» — обязательное описание */}
          {reason === "Other" && (
            <div className="f">
              <label>Что случилось</label>
              <input
                type="text"
                placeholder="Опишите причину"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}

          <button className="btn-direct" onClick={submitDirect} disabled={sending}>
            {sending ? "Списываем…" : "Списать"}
          </button>
        </div>
      </div>
    </div>
  );
}