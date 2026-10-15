import { useEffect, useRef, useState } from "react";
import { getOrdersFull, getDishes, markItemReady, cancelOrder, confirmAction } from "./api";
import type { Dish, OrderFull } from "./api";
import { fmtQty } from "./format";

// Стили — рабочий экран повара, палитра остальных страниц
const css = `
.head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.page-title { font-size: 22px; font-weight: 700; margin: 0; color: #1f2b38; }
.waiting { font-size: 12.5px; font-weight: 700; padding: 5px 12px;
           border-radius: 999px; background: #fdf1dd; color: #a5701f;
           border: 1px solid #f3ddb6; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
        padding: 18px 20px; margin-bottom: 16px; }
.order-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
/* Отмена заказа: гость не пришёл, снимаем с кухни и возвращаем товар */
.order-cancel { margin-left: auto; background: #fff; color: #b42318;
                border: 1px solid #f0c3c0; border-radius: 6px;
                padding: 6px 12px; font-size: 13px; font-weight: 600;
                cursor: pointer; }
.order-cancel:hover:not(:disabled) { background: #fdeaea; }
.order-cancel:disabled { opacity: 0.55; cursor: default; }
.table-num { font-size: 26px; font-weight: 800; color: #1f2b38; line-height: 1; }
/* Навынос выделяем: повар сразу видит, что это не заказ «в зал»,
   а блюдо, которое надо упаковать с собой */
.takeaway { font-size: 15px; font-weight: 800; color: #b45309; line-height: 1;
            background: #fef3c7; border: 1px solid #f3ddb6;
            border-radius: 999px; padding: 7px 14px; }
.order-time { font-size: 13px; color: #7b8794; }
.mode { font-size: 11.5px; font-weight: 600; padding: 4px 11px;
        border-radius: 999px; background: #eef1f5; color: #5a6675; }
.mode-ready { background: #fdf1dd; color: #a5701f; border: 1px solid #f3ddb6; }
.item { border-top: 1px solid #eef0f3; margin-top: 14px; padding-top: 14px; }
.item-head { display: flex; align-items: center; gap: 10px; }
.dish { font-size: 15px; font-weight: 700; color: #1f2b38; }
.count { font-size: 14px; color: #7b8794; }
.done-tag { margin-left: auto; font-size: 12.5px; font-weight: 700;
            color: #2f9e63; background: #e9f7ef; border: 1px solid #bfe8cf;
            padding: 4px 11px; border-radius: 999px; }
.batch-title { margin: 12px 0 4px; font-size: 12px; font-weight: 700;
               text-transform: uppercase; letter-spacing: 0.4px; color: #7b8794; }
.batch { display: flex; align-items: center; gap: 10px; padding: 6px 0;
         font-size: 13.5px; color: #4b5563; }
.batch .b-name { font-weight: 600; color: #1f2b38; }
.batch .b-deliv { color: #7b8794; }
.batch .b-exp { color: #d0342c; font-weight: 600; }
.batch .b-qty { margin-left: auto; font-weight: 700; color: #1f2b38; }
.no-batch { font-size: 12.5px; color: #7b8794; padding: 4px 0 0; }
.acts { display: flex; gap: 10px; margin-top: 12px; }
.btn-tech { background: #fff; color: #2e7fb5; border: 1px solid #bcd6e6;
            border-radius: 6px; padding: 7px 14px; font-size: 12.5px;
            font-weight: 600; cursor: pointer; }
.btn-tech:hover { background: #f0f6fa; }
.btn-done { background: #2f9e63; color: #fff; border: none; border-radius: 6px;
            padding: 7px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.btn-done:hover { background: #268052; }
.btn-done:disabled { opacity: 0.6; cursor: default; }
.tech { margin-top: 10px; padding: 11px 13px; background: #f6f7f8;
        border: 1px solid #e8ebed; border-radius: 8px; }
.tech-title { font-size: 12px; font-weight: 700; color: #1f2b38; margin-bottom: 6px; }
.tech-row { display: flex; font-size: 13px; color: #4b5563; padding: 3px 0; }
.tech-row .t-qty { margin-left: auto; font-weight: 700; color: #1f2b38; }
.empty { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px;
         padding: 26px 20px; color: #7b8794; font-size: 14px; text-align: center; }
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

// "2026-10-08" -> "08.10"
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}`;
}

// Раздел «Кухня» — рабочий экран повара
export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderFull[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Раскрытая технологическая карта: ключ "заказ-блюдо"
  const [techCard, setTechCard] = useState<string | null>(null);
  // Заказ, который сейчас отменяем — на его кнопке показываем «Отменяем…»
  const [busyOrder, setBusyOrder] = useState<number | null>(null);

  // Отмена заказа. Товар возвращается на склад автоматически на сервере,
  // поэтому здесь только спрашиваем подтверждение и перечитываем кухню.
  const handleCancel = async (order: OrderFull) => {
    if (!confirmAction(
      `Отменить заказ №${order.id}? Продукты вернутся на склад.`
    )) return;

    setBusyOrder(order.id);
    try {
      await cancelOrder(order.id);
      setTechCard(null);
      setError("");
      await load();
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось отменить заказ");
      await load();
    } finally {
      setBusyOrder(null);
    }
  };

  // Какие заказы повар уже видел — по ним и считаем, что новые.
  // Храним в ref: это служебные данные, ререндер из-за них не нужен.
  const seenIds = useRef<Set<number> | null>(null);
  // Заказы, которые только что появились: им один раз добавляем мигание
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const [o, d] = await Promise.all([getOrdersFull(), getDishes()]);
      // На кухне только активные заказы: отменённые и те, где все блюда
      // уже отмечены готовыми. Повару доска — рабочая, а не архив.
      const visible = o
        .filter((x) => x.status !== "Cancelled")
        .filter((x) => x.items.length > 0 && !x.items.every((i) => i.status === "Ready"))
        .sort((a, b) => b.id - a.id);

      // Первый раз показываем всё без мигания. Дальше мигают только те,
      // кого раньше на экране не было: повар краем глаза замечает новый заказ.
      const ids = new Set(visible.map((x) => x.id));
      if (seenIds.current === null) {
        seenIds.current = ids;
      } else {
        const fresh = new Set(visible.filter((x) => !seenIds.current!.has(x.id)).map((x) => x.id));
        seenIds.current = ids;
        if (fresh.size > 0) setFreshIds(fresh);
      }

      setOrders(visible);
      setDishes(d);
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
    // Кухня живёт своей жизнью — обновляемся раз в секунду.
    // Задержка на экране заметна повару, а нагрузка при нашем масштабе
    // (пара открытых экранов) ничтожна.
    // Интервал чистим при уходе со страницы, иначе накопятся.
    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, []);

  // Счётчик: заказы, где есть хотя бы одно неготовое блюдо
  const waiting = orders.filter((o) => o.items.some((i) => i.status === "New")).length;

  // Отметить блюдо готовым: серверу — запрос, экрану — зелёное сразу
  const markReady = async (orderId: number, dishId: number) => {
    try {
      await markItemReady(orderId, dishId);
      // В заглушке сервер ничего не меняет — красим сами.
      // И сразу убираем заказ, если последнее блюдо в нём теперь готово:
      // отработанный заказ повару на доске не нужен.
      setOrders((prev) =>
        prev
          .map((o) =>
            o.id !== orderId
              ? o
              : {
                  ...o,
                  items: o.items.map((it) =>
                    it.dishId === dishId ? { ...it, status: "Ready" as const } : it
                  ),
                }
          )
          .filter((o) => !o.items.every((it) => it.status === "Ready"))
      );
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось отметить блюдо");
    }
  };

  // Кнопка «Технологическая карта» — раскрыть/скрыть рецепт блюда
  const toggleTech = (orderId: number, dishId: number) => {
    const key = `${orderId}-${dishId}`;
    setTechCard((prev) => (prev === key ? null : key));
  };

  return (
    <div>
      <style>{css}</style>

      <div className="head">
        <h1 className="page-title">Заказы на кухне</h1>
        <span className="waiting">Заказов ждут: {waiting}</span>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Загрузка…</p>}

      {!loading && orders.length === 0 && (
        <div className="empty">Заказов пока нет</div>
      )}

      {orders.map((order) => (
        <div
          className={freshIds.has(order.id) ? "card flash-new" : "card"}
          key={order.id}
          onAnimationEnd={() =>
            setFreshIds((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            })
          }
        >
          <div className="order-head">
            {/* Стол крупно. Если стола нет — заказ навынос: это не «нет
                данных», повару сразу видно, что блюдо надо упаковать. */}
            {order.tableNumber ? (
              <span className="table-num">Стол {order.tableNumber}</span>
            ) : (
              <span className="takeaway">Навынос</span>
            )}
            <span className="order-time">
              Заказ №{order.id} · {fmtWhen(order.createdAt)}
            </span>
            <span className={order.serveMode === "AsReady" ? "mode mode-ready" : "mode"}>
              {MODE_LABELS[order.serveMode]}
            </span>

            {/* Отмена заказа: гость не пришёл. Продукты вернутся на склад
                по тем же партиям, откуда они ушли. */}
            <button
              className="order-cancel"
              disabled={busyOrder === order.id}
              onClick={() => handleCancel(order)}
            >
              {busyOrder === order.id ? "Отменяем…" : "Отменить заказ"}
            </button>
          </div>

          {order.items.map((item, i) => {
            const key = `${order.id}-${item.dishId}`;
            const dish = dishes.find((d) => d.id === item.dishId);
            const isOpen = techCard === key;

            return (
              <div className="item" key={`${key}-${i}`}>
                <div className="item-head">
                  <span className="dish">{item.dishName}</span>
                  <span className="count">× {item.quantity}</span>
                  {item.status === "Ready" && <span className="done-tag">Готово ✓</span>}
                </div>

                {/* Из какой партии брать — FEFO считает сервер, мы только показываем */}
                {item.batches.length > 0 ? (
                  <>
                    <div className="batch-title">Брать из партии</div>
                    {item.batches.map((b, j) => (
                      <div className="batch" key={`${key}-b-${j}`}>
                        <span className="b-name">{b.productName}</span>
                        <span className="b-deliv">{b.deliveryNumber ?? "—"}</span>
                        <span className="b-exp">{fmtDate(b.batchExpiry)}</span>
                        <span className="b-qty">{fmtQty(b.quantity)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="no-batch">Партии подобраны сервером по FEFO</div>
                )}

                {/* Технологическая карта — рецепт блюда */}
                {isOpen && dish && (
                  <div className="tech">
                    <div className="tech-title">Технологическая карта — {dish.name}</div>
                    {dish.recipe.length === 0 && (
                      <div className="tech-row">Рецепт не задан</div>
                    )}
                    {dish.recipe.map((r, j) => (
                      <div className="tech-row" key={`${key}-r-${j}`}>
                        <span>{r.productName}</span>
                        <span className="t-qty">{fmtQty(r.quantityPerPortion)} на порцию</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Готово второй раз не показываем — блюдо уже готово */}
                {item.status !== "Ready" && (
                  <div className="acts">
                    <button className="btn-tech" onClick={() => toggleTech(order.id, item.dishId)}>
                      {isOpen ? "Скрыть карту" : "Технологическая карта"}
                    </button>
                    <button className="btn-done" onClick={() => markReady(order.id, item.dishId)}>
                      Готово
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}