import { useEffect, useState } from "react";
import { getDishes, getProducts, createOrder } from "./api";
import SearchBox from "./SearchBox";
import type { Dish, Product, ServeMode } from "./api";

// Стили — по макету design/официант новая продажа.jpg
// (структура из ТЗ: слева блюда, справа корзина)
const css = `
.page-title { margin: 0 0 20px; font-size: 28px; font-weight: 800; color: #344054; }
.order-meta { display: flex; gap: 16px; margin: 0 0 16px; }
.order-meta .field { display: flex; flex-direction: column; gap: 5px; }
.order-meta label { font-size: 12px; color: #7b8794; }
.order-meta input, .order-meta select {
  height: 38px; padding: 0 10px; font-size: 13.5px; color: #1f2b38;
  background: #fff; border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.order-meta input:focus, .order-meta select:focus {
  border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.columns { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }
.panel { background: #fff; border: 1px solid #e5e8ec; border-radius: 12px;
         padding: 24px; }
.panel-title { margin: 0 0 16px; font-size: 15px; font-weight: 700; color: #7c8896; }
.dish-card { border: 1px solid #eef0f3; border-radius: 8px; padding: 16px;
             margin-bottom: 12px; }
.dish-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dish-name { margin: 0; font-size: 17px; font-weight: 700; color: #344054; }
.dish-recipe { margin: 6px 0 8px; font-size: 13px; color: #9aa4af; }
.badge-ok { color: #2f9e63; font-size: 14px; }
.badge-stop { color: #d0342c; font-size: 14px; }
.btn-add { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
           padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer;
           white-space: nowrap; }
.btn-add:hover:not(:disabled) { background: #276f9f; }
.btn-add:disabled { background: #d6dbdf; cursor: not-allowed; }
.cart-row { display: flex; align-items: center; gap: 12px; padding: 12px 0;
            border-bottom: 1px solid #eef0f3; }
.cart-name { flex: 1; font-size: 15px; color: #2b3440; font-weight: 600; }
.cart-qty { width: 80px; height: 38px; padding: 0 10px; font-size: 15px;
            border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.cart-qty:focus { border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn-remove { background: #fdeaea; color: #d0342c; border: none; border-radius: 6px;
              padding: 9px 14px; font-size: 14px; cursor: pointer; }
.btn-remove:hover { background: #f9d7d7; }
.empty { color: #8a94a0; font-size: 15px; margin: 8px 0 16px; }
.total { margin: 16px 0; padding: 14px 16px; background: #f5f7f8;
         border-radius: 8px; font-size: 15px; color: #344054; font-weight: 600; }
.actions { display: flex; gap: 12px; }
.btn-cancel { background: #eef1f4; color: #55606e; border: 1px solid #d6dbdf;
              border-radius: 6px; padding: 13px 26px; font-size: 15px;
              font-weight: 600; cursor: pointer; }
.btn-cancel:hover { background: #e2e7ec; }
.btn-submit { background: #2f9e63; color: #fff; border: none; border-radius: 6px;
              padding: 13px 26px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-submit:hover:not(:disabled) { background: #278a55; }
.btn-submit:disabled { opacity: 0.7; cursor: default; }
.msg { padding: 13px 16px; border-radius: 8px; font-size: 15px; margin-bottom: 16px; }
.msg-ok { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.msg-err { background: #fdeaea; color: #d0342c; border: 1px solid #f6c9c7; }
.loading { color: #8a94a0; font-size: 16px; }
`;

// Количество «красиво»: 0.2 → «0,20», целое 1 → «1»
function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(".", ",");
}

// Строка корзины: количество храним строкой, чтобы удобно редактировать полем
type CartRow = { dishId: number; quantity: string };

// «1 порция», «2 порции», «5 порций»
function portionsWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (last === 1 && abs !== 11) return "порция";
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return "порции";
  return "порций";
}

// Раздел «Новый заказ»: слева блюда с доступностью, справа корзина
export default function NewOrderPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");

  // Стол и режим подачи — уходят на сервер вместе с заказом
  const [table, setTable] = useState("");
  const [serveMode, setServeMode] = useState<ServeMode>("AllAtOnce");

  // Загрузка блюд и продуктов (продукты — для единиц измерения в составе)
  const load = async () => {
    setLoading(true);
    try {
      const [dishData, productData] = await Promise.all([getDishes(), getProducts()]);
      setDishes(dishData);
      setProducts(productData);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить блюда");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Единица измерения продукта по id
  const unitOf = (productId: number): string => {
    const p = products.find((x) => x.id === productId);
    return p ? p.unit : "";
  };

  // Состав одной строкой: «Курица 0,20 кг, Помидор 0,10 кг»
  const recipeLine = (dish: Dish): string =>
    dish.recipe
      .map((r) => `${r.productName} ${formatQty(r.quantityPerPortion)} ${unitOf(r.productId)}`)
      .join(", ");

  // Поиск по блюдам: сначала по первой букве, дальше по любому фрагменту.
  // Пробел в запросе означает «и ещё», поэтому «цы кар» найдёт «Цезарь с курицей».
  const q = query.trim().toLowerCase();
  const shownDishes = q
    ? dishes.filter((d) =>
        [d.name, d.reason ?? ""].join(" ").toLowerCase().split(q).length > 1
      )
    : dishes;

  const maxOf = (dishId: number) =>
    dishes.find((d) => d.id === dishId)?.availablePortions ?? 0;

  // Добавить блюдо в корзину. Больше, чем доступно, добавить не даём —
  // иначе официант узнает об этом только при оформлении.
  const addToCart = (dish: Dish) => {
    setError("");
    setSuccess("");
    const max = dish.availablePortions;
    const row = cart.find((r) => r.dishId === dish.id);
    const current = row ? Number(row.quantity) || 0 : 0;

    if (max <= 0 || current >= max) {
      setError(
        max <= 0
          ? `Блюдо «${dish.name}» сейчас недоступно`
          : `По блюду «${dish.name}» доступно только ${max} ${portionsWord(max)}`
      );
      return;
    }

    setCart((prev) => {
      const found = prev.find((row2) => row2.dishId === dish.id);
      if (found) {
        return prev.map((row2) =>
          row2.dishId === dish.id
            ? { ...row2, quantity: String(Number(row2.quantity) + 1) }
            : row2
        );
      }
      return [...prev, { dishId: dish.id, quantity: "1" }];
    });
  };

  // Изменить количество: обрезаем по доступному, чтобы нельзя было вписать 99
  const updateQty = (dishId: number, quantity: string) => {
    const max = maxOf(dishId);
    let n = Number(quantity.replace(",", "."));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > max) n = max;
    setCart((prev) =>
      prev.map((row) => (row.dishId === dishId ? { ...row, quantity: String(n) } : row))
    );
  };

  // Удалить строку из корзины
  const removeFromCart = (dishId: number) => {
    setCart((prev) => prev.filter((row) => row.dishId !== dishId));
  };

  // Оформить заказ
  const submit = async () => {
    setError("");
    setSuccess("");

    // Не отправляем пустую корзину и мусор в полях
    if (cart.length === 0) {
      setError("Корзина пуста — добавьте хотя бы одно блюдо");
      return;
    }
    for (const row of cart) {
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Количество порций должно быть больше нуля");
        return;
      }
      // Проверяем ещё раз на всякий случай: состав блюда мог измениться,
      // пока официант собирал заказ
      const max = maxOf(row.dishId);
      if (qty > max) {
        const dish = dishes.find((d) => d.id === row.dishId);
        setError(
          `По блюду «${dish?.name ?? "без названия"}» доступно только ` +
          `${max} ${portionsWord(max)} — поставьте ${max}`
        );
        return;
      }
    }

    setSending(true);
    try {
      const items = cart.map((row) => ({
        dishId: row.dishId,
        quantity: Number(row.quantity),
      }));
      // Стол пустой → уйдёт null, кухня покажет «Без стола»
      const result = await createOrder(items, table.trim() || null, serveMode);
      // Успех: синее сообщение, корзина и стол пустые, блюда перезагружаем
      setSuccess(
        `Заказ №${result.id} оформлен — ` +
        (table.trim() ? `стол ${table.trim()}` : "навынос")
      );
      setCart([]);
      setTable("");
      await load();
    } catch (err) {
      // Нехватка и прочие ошибки сервера — красным, заказ НЕ оформился
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      let text = e.response?.data?.error ?? e.message ?? "Не удалось оформить заказ";

      // Сервер сказал «не хватает продукта». Дописываем, сколько порций
      // реально есть по каждому блюду в корзине — чтобы официанту не
      // пришлось угадывать, уменьшая по одной порции.
      if (/Недостаточно/i.test(text)) {
        const limits = cart
          .map((row) => {
            const dish = dishes.find((d) => d.id === row.dishId);
            return dish ? `${dish.name} — ${dish.availablePortions} ${portionsWord(dish.availablePortions)}` : null;
          })
          .filter(Boolean)
          .join(", ");
        if (limits) text = `${text}. Сейчас доступно: ${limits}.`;
      }

      setError(text);
      // Состав мог поменяться — обновляем, чтобы цифры были свежими
      await load();
    } finally {
      setSending(false);
    }
  };

  // «Отмена»: чистим корзину и сообщения
  const cancel = () => {
    setCart([]);
    setError("");
    setSuccess("");
  };

  // Итог по корзине
  const totalPortions = cart.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  return (
    <div>
      <style>{css}</style>
      <h1 className="page-title">Новый заказ</h1>

      {/* Стол и режим подачи — над двумя колонками */}
      <div className="order-meta">
        <div className="field">
          <label>Стол</label>
          <input
            type="text"
            placeholder="5, VIP-2, бар 1"
            value={table}
            onChange={(e) => setTable(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Как подавать</label>
          <select
            value={serveMode}
            onChange={(e) => setServeMode(e.target.value as ServeMode)}
          >
            <option value="AllAtOnce">Всё сразу</option>
            <option value="AsReady">По мере готовности</option>
          </select>
        </div>
      </div>

      <div className="columns">
        {/* Левая колонка — список блюд с доступностью */}
        <div className="panel">
          <div className="panel-title">Блюда</div>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Найти блюдо…"
            found={shownDishes.length}
            total={dishes.length}
          />
          {loading ? (
            <p className="loading">Загрузка…</p>
          ) : shownDishes.length === 0 ? (
            <p className="empty">Ничего не найдено</p>
          ) : (
            shownDishes.map((dish) => (
              <div className="dish-card" key={dish.id}>
                <div className="dish-head">
                  <h3 className="dish-name">{dish.name}</h3>
                  <button
                    className="btn-add"
                    disabled={dish.inStopList || dish.availablePortions === 0}
                    onClick={() => addToCart(dish)}
                  >
                    + Добавить
                  </button>
                </div>
                <p className="dish-recipe">{recipeLine(dish)}</p>
                {dish.inStopList ? (
                  <span className="badge-stop">в стоп-листе: {dish.reason}</span>
                ) : (
                  <span className="badge-ok">
                    доступно {dish.availablePortions} {portionsWord(dish.availablePortions)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Правая колонка — корзина заказа */}
        <div className="panel">
          <div className="panel-title">Корзина заказа</div>

          {error && <div className="msg msg-err">{error}</div>}
          {success && <div className="msg msg-ok">{success}</div>}

          {cart.length === 0 ? (
            <p className="empty">Корзина пуста — нажмите «+ Добавить» у блюда слева</p>
          ) : (
            cart.map((row) => {
              const dish = dishes.find((d) => d.id === row.dishId);
              return (
                <div className="cart-row" key={row.dishId}>
                  <span className="cart-name">{dish ? dish.name : "?"}</span>
                  <input
                    className="cart-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => updateQty(row.dishId, e.target.value)}
                  />
                  <button className="btn-remove" onClick={() => removeFromCart(row.dishId)}>
                    Удалить
                  </button>
                </div>
              );
            })
          )}

          <div className="total">
            Итого: {cart.length} позиц., {totalPortions} порц.
          </div>

          <div className="actions">
            <button className="btn-cancel" onClick={cancel}>
              Отмена
            </button>
            <button className="btn-submit" disabled={sending} onClick={submit}>
              {sending ? "Оформление…" : "Оформить заказ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}