import { useEffect, useState } from "react";
import { getDishes, getProducts, createOrder } from "./api";
import type { Dish, Product } from "./api";

// Стили — по макету design/официант новая продажа.jpg
// (структура из ТЗ: слева блюда, справа корзина)
const css = `
.page-title { margin: 0 0 20px; font-size: 28px; font-weight: 800; color: #344054; }
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

// Раздел «Новый заказ»: слева блюда с доступностью, справа корзина
export default function NewOrderPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);

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

  // Добавить блюдо в корзину (у стоп-листа кнопка и так заблокирована)
  const addToCart = (dish: Dish) => {
    setError("");
    setSuccess("");
    setCart((prev) => {
      const found = prev.find((row) => row.dishId === dish.id);
      if (found) {
        // Уже в корзине — плюсуем порцию
        return prev.map((row) =>
          row.dishId === dish.id
            ? { ...row, quantity: String(Number(row.quantity) + 1) }
            : row
        );
      }
      return [...prev, { dishId: dish.id, quantity: "1" }];
    });
  };

  // Изменить количество в строке корзины
  const updateQty = (dishId: number, quantity: string) => {
    setCart((prev) => prev.map((row) => (row.dishId === dishId ? { ...row, quantity } : row)));
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
      const q = Number(row.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        setError("Количество порций должно быть больше нуля");
        return;
      }
    }

    setSending(true);
    try {
      const items = cart.map((row) => ({
        dishId: row.dishId,
        quantity: Number(row.quantity),
      }));
      const result = await createOrder(items);
      // Успех: зелёное сообщение, корзина пустая, блюда перезагружаем
      setSuccess(`Заказ №${result.id} оформлен`);
      setCart([]);
      await load();
    } catch (err) {
      // Нехватка и прочие ошибки сервера — красным, заказ НЕ оформился
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось оформить заказ");
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

      <div className="columns">
        {/* Левая колонка — список блюд с доступностью */}
        <div className="panel">
          <div className="panel-title">Блюда</div>
          {loading ? (
            <p className="loading">Загрузка…</p>
          ) : (
            dishes.map((dish) => (
              <div className="dish-card" key={dish.id}>
                <div className="dish-head">
                  <h3 className="dish-name">{dish.name}</h3>
                  <button
                    className="btn-add"
                    disabled={dish.inStopList}
                    onClick={() => addToCart(dish)}
                  >
                    + Добавить
                  </button>
                </div>
                <p className="dish-recipe">{recipeLine(dish)}</p>
                {dish.inStopList ? (
                  <span className="badge-stop">в стоп-листе: {dish.reason}</span>
                ) : (
                  <span className="badge-ok">доступно {dish.availablePortions} порций</span>
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