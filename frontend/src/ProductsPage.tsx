import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getProducts, createProduct, archiveProduct } from "./api";
import type { Product } from "./api";

// Стили раздела — по макету design/управляющий продукты.jpg
const css = `
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { margin: 0; font-size: 28px; font-weight: 800; color: #344054; }
.btn-primary { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
               padding: 12px 20px; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-primary:hover:not(:disabled) { background: #276f9f; }
.btn-primary:disabled { opacity: 0.7; cursor: default; }
.form-card { background: #fff; border: 1px solid #e5e8ec; border-radius: 8px;
             padding: 16px; margin-bottom: 20px; display: flex; align-items: flex-end; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; color: #7c8896; }
.input { height: 40px; padding: 0 12px; font-size: 14px; color: #2b3440;
         border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.input:focus { border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn-save { background: #2e7fb5; color: #fff; border: none; border-radius: 6px;
            padding: 11px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
.btn-save:hover:not(:disabled) { background: #276f9f; }
.btn-cancel { background: #eef1f4; color: #55606e; border: none; border-radius: 6px;
              padding: 11px 20px; font-size: 14px; cursor: pointer; }
.btn-cancel:hover { background: #e2e7ec; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
.loading { color: #8a94a0; font-size: 16px; }
.table { width: 100%; border-collapse: collapse; background: #fff;
         border: 1px solid #e6e9ed; border-radius: 8px; overflow: hidden; }
.table th { background: #f5f7f8; text-align: left; padding: 13px 16px;
            font-size: 14px; font-weight: 700; color: #344054; }
.table td { padding: 15px 16px; border-top: 1px solid #eef0f3; font-size: 15px; color: #4b5563; }
.table tbody tr:hover td { background: #f8fafb; }
.btn-archive { background: #eef1f4; color: #55606e; border: none; border-radius: 6px;
               padding: 7px 14px; font-size: 14px; cursor: pointer; }
.btn-archive:hover { background: #fdeaea; color: #d0342c; }
.empty { padding: 20px 16px; color: #8a94a0; }
`;

// Пустая форма добавления
const emptyForm = { name: "", unit: "", minStock: "", shelfLifeDays: "" };

// Достаём текст ошибки: сначала ответ сервера, потом message, потом запасной
function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error ?? e.message ?? fallback;
}

// Раздел «Продукты»: таблица, добавление, архивация
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Загрузка списка с сервера (пока — из заглушки)
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setProducts(await getProducts());
    } catch (err) {
      setError(errorText(err, "Не удалось загрузить список"));
    } finally {
      setLoading(false);
    }
  };

  // При монтировании компонента (один раз при открытии раздела)
  useEffect(() => {
    load();
  }, []);

  // Сохранение нового продукта
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const minStock = Number(form.minStock);
    const shelfLifeDays = Number(form.shelfLifeDays);
    if (!form.name.trim() || !form.unit.trim()) {
      setError("Заполните название и единицу измерения");
      return;
    }
    if (Number.isNaN(minStock) || Number.isNaN(shelfLifeDays)) {
      setError("Мин. остаток и срок хранения должны быть числами");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createProduct({ name: form.name.trim(), unit: form.unit.trim(), minStock, shelfLifeDays });
      setForm(emptyForm);
      setShowForm(false);
      await load(); // перезагружаем список — в таблице появится новая строка
    } catch (err) {
      setError(errorText(err, "Не удалось сохранить"));
    } finally {
      setSaving(false);
    }
  };

  // Архивация: удаляем строку и перезагружаем список
  const handleArchive = async (id: number) => {
    setError("");
    try {
      await archiveProduct(id);
      await load();
    } catch (err) {
      setError(errorText(err, "Не удалось архивировать продукт"));
    }
  };

  return (
    <div>
      <style>{css}</style>
      <div className="page-head">
        <h1 className="page-title">Продукты</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Добавить продукт
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleSave}>
          <div className="field">
            <span className="field-label">Название</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Единица измерения</span>
            <input
              className="input"
              placeholder="кг / л / шт"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Минимальный остаток</span>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Срок хранения (дней)</span>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={form.shelfLifeDays}
              onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button type="button" className="btn-cancel" onClick={() => { setShowForm(false); setError(""); }}>
            Отмена
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="loading">Загрузка…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Единица</th>
              <th>Мин. остаток</th>
              <th>Срок хранения (дней)</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td className="empty" colSpan={5}>
                  Продуктов нет — добавьте первый
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.unit}</td>
                <td>{p.minStock}</td>
                <td>{p.shelfLifeDays}</td>
                <td>
                  <button className="btn-archive" onClick={() => handleArchive(p.id)}>
                    В архив
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}