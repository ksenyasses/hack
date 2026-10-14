import { useEffect, useState } from "react";
import { getOrdersFull, cancelOrder, confirmAction } from "./api";
import type { OrderFull } from "./api";

// Стили — карточки заказов в палитре остальных страниц
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #1f2b38; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; margin-bottom: 16px; }
.order-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.order-num { font-size: 17px; font-weight: 700; color: #1f2b38; }
.order-time { font-size: 13px; color: #7b8794; }
.order-table { font-size: 13px; color: #1f2b38; font-weight: 600; }
.mode { display: inline-block; margin-top: 10px; font-size: 11.5px; font-weight: 600;
        padding: 4px 11px; border-radius: 999px; background: #eef1f5; color: #5a6675; }
.mode-ready { background: #fdf1dd; color: #a5701f; border: 1px solid #f3ddb6; }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 0;
       border-top: 1px solid #eef0f3; margin-top: 12px; }
.dish { font-size: 14px; font-weight: 600; color: #1f2b38; }
.count { font-size: 13.5px; color: #7b8794; }
.status { margin-left: auto; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
.status-ready { color: #2f9e63; }
.status-new { color: #7b8794; font-weight: 600; }
.empty { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
         padding: 26px 20px; color: #7b8794; font-size: 14px; text-align: center; }
.btn-cancel { background: #fff; color: #d0342c; border: 1px solid #f0c3c0;
              border-radius: 6px; padding: 7px 14px; margin-top: 14px;
              font-size: 12.5px; font-weight: 600; cursor: pointer; }
.btn-cancel:hover:not(:disabled) { background: #fdeaea; }
.btn-cancel:disabled { opacity: 0.5; cursor: default; }
.loading { color: #7b8794; font-size: 16px; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
`;

// Подпись режима подачи
const MODE_LABELS: Record<OrderFull["serveMode"], string> = {
  AsReady: "по мере готовности",
  AllAtOnce: "подать всё сразу",
};

// "2026-10-11T15:42:00Z" -> "11.10, 18:42" (или "сегодня, 15:42")
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (d.toDateString() === new Date().toDateString()) return `сегодня, ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mo}, ${hh}:${mm}`;
}

// Раздел «Мои заказы» — официант следит за готовностью своих заказов
export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await getOrdersFull();
      // Отменённые не показываем, свежие сверху — по убыванию id
      setOrders(
        data
          .filter((o) => o.status !== "Cancelled")
          .sort((a, b) => b.id - a.id)
      );
      setError("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Кухня меняет готовность сама — обновляемся раз в 10 секунд.
    // Интервал обязательно чистим при уходе со страницы, иначе накопятся.
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  // Отмена заказа: товар возвращается на склад, блюда уходят из стоп-листа.
  // Пока хоть одно блюдо готово — отменять поздно, сервер это отклонит.
  const handleCancel = async (id: number) => {
    setError("");
    if (!confirmAction(
      "Отменить заказ?\nПродукты вернутся на склад, блюда снова станут доступны."
    )) {
      return;
    }
    try {
      await cancelOrder(id);
      await load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось отменить заказ");
    }
  };

  return (
    <div>
      <style>{css}</style>

      <h1 className="page-title">Мои заказы</h1>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Загрузка…</p>}

      {!loading && orders.length === 0 && (
        <div className="empty">Заказов пока нет</div>
      )}

      {orders.map((order) => {
        // Отменять можно, пока ни одно блюдо не отмечено готовым
        const canCancel = order.items.every((item) => item.status !== "Ready");
        return (
        <div className="card" key={order.id}>
          <div className="order-head">
            <span className="order-num">Заказ №{order.id}</span>
            <span className="order-time">{fmtWhen(order.createdAt)}</span>
            <span className="order-table">
              {order.tableNumber ? `Стол ${order.tableNumber}` : "Навынос"}
            </span>
          </div>

          <span className={order.serveMode === "AsReady" ? "mode mode-ready" : "mode"}>
            {MODE_LABELS[order.serveMode]}
          </span>

          {order.items.map((item, i) => (
            <div className="row" key={`${order.id}-${item.dishId}-${i}`}>
              <span className="dish">{item.dishName}</span>
              <span className="count">×{item.quantity}</span>
              {item.status === "Ready" ? (
                <span className="status status-ready">Готово ✓</span>
              ) : (
                <span className="status status-new">Готовится</span>
              )}
            </div>
          ))}

          <button
            className="btn-cancel"
            disabled={!canCancel}
            onClick={() => handleCancel(order.id)}
          >
            {canCancel ? "Отменить заказ" : "Уже начали готовить"}
          </button>
        </div>
        );
      })}
    </div>
  );
}