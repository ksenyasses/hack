import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getDishes, getProducts, createDish, updateDish } from "./api";
import type { Dish, Product } from "./api";

// Стили раздела — по макету design/управляющий блюда и рецепты.jpg
const css = `
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: #344054; }
.btn-primary { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
               padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-primary:hover { background: #276f9f; }
.card { background: #fff; border: 1px solid #e5e8ec; border-radius: 8px;
        padding: 20px 24px; margin-bottom: 16px; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; }
.dish-name { margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #344054; }
.badge-ok { color: #2f9e63; font-size: 14px; }
.badge-stop { color: #d0342c; font-size: 14px; }
.btn-edit { background: #eef1f4; color: #344054; border: none; border-radius: 6px;
            padding: 8px 18px; font-size: 14px; cursor: pointer; }
.btn-edit:hover { background: #e2e7ec; }
.recipe-label { margin: 16px 0 8px; font-size: 13px; color: #9aa4af; }
.recipe-row { display: flex; justify-content: space-between; padding: 12px 16px;
              font-size: 15px; color: #4b5563; border-top: 1px solid #eef0f3; }
.recipe-row:first-of-type { background: #f5f7f8; border-top: none;
                            font-weight: 700; color: #344054; }
.form-card { background: #fff; border: 1px solid #e5e8ec; border-radius: 8px;
             padding: 24px; margin-bottom: 20px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; max-width: 500px; }
.field-label { font-size: 13px; color: #7c8896; }
.input, .select { height: 42px; padding: 0 14px; font-size: 15px; color: #2b3440;
                  border: 1px solid #d6dbdf; border-radius: 6px; outline: none; background: #fff; }
.input:focus, .select:focus { border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.rows-labels { display: flex; gap: 12px; margin: 20px 0 8px; font-size: 13px; color: #7c8896; }
.row { display: flex; gap: 12px; margin-bottom: 10px; align-items: center; }
.row .select { flex: 2; }
.row .input { flex: 1; }
.btn-remove { background: #fdeaea; color: #d0342c; border: none; border-radius: 6px;
              padding: 10px 14px; font-size: 14px; cursor: pointer; white-space: nowrap; }
.btn-remove:hover { background: #f9d7d7; }
.btn-add { background: #eef1f4; color: #344054; border: none; border-radius: 6px;
           padding: 11px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
.btn-add:hover { background: #e2e7ec; }
.actions { display: flex; gap: 12px; }
.btn-save { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
            padding: 13px 26px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-save:hover:not(:disabled) { background: #276f9f; }
.btn-save:disabled { opacity: 0.7; cursor: default; }
.btn-cancel { background: #eef1f4; color: #55606e; border: none; border-radius: 6px;
              padding: 13px 26px; font-size: 15px; cursor: pointer; }
.btn-cancel:hover { background: #e2e7ec; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
.loading { color: #8a94a0; font-size: 16px; }
`;

// Количество на порцию: 0.2 → «0,20», а целое 1 → «1»
function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(".", ",");
}

// Одна строка рецепта в форме
type Row = { productId: string; quantity: string };

const emptyRow: Row = { productId: "", quantity: "" };

// Раздел «Блюда»: карточки блюд с рецептурой и форма создания/правки
export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Форма
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // null — создаём новое
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [saving, setSaving] = useState(false);

  // Роль смотрим в localStorage: «Изменить» — только управляющему
  const isManager = localStorage.getItem("role") === "Manager";

  // Загрузка блюд и продуктов (продукты — чтобы показать единицу измерения)
  const load = async () => {
    setLoading(true);
    setError("");
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

  // Открыть форму: создать новое или отредактировать существующее
  const openAdd = () => {
    setEditingId(null);
    setName("");
    setRows([{ ...emptyRow }]);
    setError("");
    setShowForm(true);
  };
  const openEdit = (dish: Dish) => {
    setEditingId(dish.id);
    setName(dish.name);
    setRows(
      dish.recipe.map((r) => ({
        productId: String(r.productId),
        quantity: String(r.quantityPerPortion),
      }))
    );
    setError("");
    setShowForm(true);
  };

  // Строки рецепта
  const addRow = () => setRows([...rows, { ...emptyRow }]);
  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };
  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  // Сохранение: создание или правка
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Проверки до отправки — понятные ошибки, а не пустое блюдо
    if (!name.trim()) {
      setError("Введите название блюда");
      return;
    }
    if (rows.length === 0) {
      setError("Добавьте хотя бы один ингредиент");
      return;
    }
    for (const r of rows) {
      if (!r.productId) {
        setError("Выберите продукт в каждой строке");
        return;
      }
      const q = Number(r.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        setError("Количество на порцию должно быть больше нуля");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const data = {
        name: name.trim(),
        recipe: rows.map((r) => ({
          productId: Number(r.productId),
          quantityPerPortion: Number(r.quantity),
        })),
      };
      if (editingId === null) {
        await createDish(data);
      } else {
        await updateDish(editingId, data);
      }
      setShowForm(false);
      await load(); // список перезагружаем — блюдо появилось/изменилось
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось сохранить блюдо");
    } finally {
      setSaving(false);
    }
  };

  // Единица измерения продукта по его id
  const unitOf = (productId: number): string => {
    const p = products.find((x) => x.id === productId);
    return p ? p.unit : "";
  };

  return (
    <div>
      <style>{css}</style>
      <div className="page-head">
        <h1 className="page-title">Блюда и рецепты</h1>
        <button className="btn-primary" onClick={openAdd}>
          + Создать блюдо
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="field">
            <span className="field-label">Название</span>
            <input
              className="input"
              placeholder="Тест-салат"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="rows-labels">
            <span style={{ flex: 2 }}>Продукт</span>
            <span style={{ flex: 1 }}>Количество на порцию</span>
            <span />
          </div>

          {rows.map((row, index) => (
            <div className="row" key={index}>
              <select
                className="select"
                value={row.productId}
                onChange={(e) => updateRow(index, { productId: e.target.value })}
              >
                <option value="">— выберите продукт —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                placeholder="0.2"
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
              />
              <button type="button" className="btn-remove" onClick={() => removeRow(index)}>
                Удалить
              </button>
            </div>
          ))}

          <button type="button" className="btn-add" onClick={addRow}>
            + Добавить ингредиент
          </button>

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
            <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="error">{error}</p>}

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : (
        dishes.map((dish) => (
          <div className="card" key={dish.id}>
            <div className="card-head">
              <div>
                <h2 className="dish-name">{dish.name}</h2>
                {dish.inStopList ? (
                  <span className="badge-stop">в стоп-листе: {dish.reason}</span>
                ) : (
                  <span className="badge-ok">доступно {dish.availablePortions} порций</span>
                )}
              </div>
              {isManager && (
                <button className="btn-edit" onClick={() => openEdit(dish)}>
                  Изменить
                </button>
              )}
            </div>
            <div className="recipe-label">Рецептура (на 1 порцию):</div>
            <div className="recipe-row">
              <span>Продукт</span>
              <span>Количество на порцию</span>
            </div>
            {dish.recipe.map((r, i) => (
              <div className="recipe-row" key={i}>
                <span>{r.productName}</span>
                <span>
                  {formatQty(r.quantityPerPortion)} {unitOf(r.productId)}/на порцию
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}