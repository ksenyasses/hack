import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "./api";

// Стили экрана входа — по макету design/вход.jpg
const css = `
.page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #e9edf0; }
.card { width: 400px; background: #fff; border: 1px solid #e2e6e9; border-radius: 8px;
        padding: 36px 40px 32px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
.brand { margin: 0; text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 1.5px; color: #2c4a63; }
.brand-sub { font-size: 14px; color: #55606e; margin: 6px 0 0; letter-spacing: 0.3px; text-align: center; }
.label { display: block; margin: 0 0 6px; font-size: 13px; color: #7c8896; }
.input { width: 100%; height: 42px; margin-bottom: 16px; padding: 0 14px; font-size: 15px;
         color: #2b3440; border: 1px solid #d6dbdf; border-radius: 6px; outline: none; }
.input:focus { border-color: #2e7fb5; box-shadow: 0 0 0 2px rgba(46,127,181,0.15); }
.btn { width: 100%; height: 46px; margin-top: 4px; font-size: 16px; font-weight: 700; color: #fff;
       background: #2e7fb5; border: none; border-radius: 6px; cursor: pointer; }
.btn:hover:not(:disabled) { background: #276f9f; }
.btn:disabled { opacity: 0.7; cursor: default; }
.error { margin: 0 0 12px; font-size: 14px; color: #d0342c; }
.demo { margin-top: 24px; padding: 12px; text-align: center; font-size: 12px; line-height: 1.6;
        color: #8b97a3; background: #f6f7f8; border: 1px solid #e8ebed; border-radius: 6px; }
`;

// Экран входа: карточка с полями Логин/Пароль и кнопкой «Войти»
export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // без этого страница перезагрузится и стейт слетит
    setError("");
    setLoading(true);
    try {
      const res = await login(loginValue, password);
      // Успех: сохраняем сессию — App прочитает её и сменит экран
      localStorage.setItem("token", res.token);
      localStorage.setItem("role", res.role);
      localStorage.setItem("fullName", res.fullName);
      onSuccess();
    } catch (err) {
      // Бэкенд отдаёт { error: "текст" }; у сетевой ошибки есть message.
      // Показываем по приоритету: текст сервера → message → запасной вариант
      const e2 = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e2.response?.data?.error ?? e2.message ?? "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <style>{css}</style>
      <div className="card">
        <h1 className="brand">KITCHEN OPERATIONS</h1>
        <p className="brand-sub">Система учёта продуктов ресторана</p>
        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="login">Логин</label>
          <input
            id="login"
            className="input"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoComplete="username"
          />
          <label className="label" htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
        <div className="demo">
          <div>Демо-доступы:</div>
          <div>manager / cook / waiter</div>
          <div>пароль: 123</div>
        </div>
      </div>
    </div>
  );
}