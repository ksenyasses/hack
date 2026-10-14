import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "./api";

// Стили экрана входа — по макету design/вход.jpg, палитра общая (theme.css)
const css = `
.page { min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: #f5f6f8; }
.card { width: 400px; max-width: calc(100vw - 32px); background: #fff;
        border: 1px solid #e7e9ec; border-radius: 14px;
        padding: 36px 40px 32px; box-shadow: 0 4px 20px rgba(16,24,40,0.06); }
.mark { width: 46px; height: 46px; margin: 0 auto 18px; border-radius: 12px;
        background: #e6f2f1; display: flex; align-items: center; justify-content: center; }
.mark svg { width: 24px; height: 24px; color: #0f766e; }
.brand { margin: 0; text-align: center; font-size: 19px; font-weight: 700;
         letter-spacing: 0.2px; color: #1b1f24; }
.brand-sub { font-size: 13.5px; color: #6b7280; margin: 7px 0 26px;
             letter-spacing: 0.1px; text-align: center; }
.label { display: block; margin: 0 0 6px; font-size: 12px; color: #6b7280; }
.input { width: 100%; height: 42px; margin-bottom: 16px; padding: 0 14px; font-size: 15px;
         color: #1b1f24; background: #fff; border: 1px solid #e7e9ec;
         border-radius: 8px; outline: none;
         transition: border-color 150ms ease, box-shadow 150ms ease; }
.input:focus { border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15,118,110,0.12); }
.btn { width: 100%; height: 46px; margin-top: 4px; font-size: 15px; font-weight: 600; color: #fff;
       background: #0f766e; border: none; border-radius: 8px; cursor: pointer;
       transition: background 150ms ease; }
.btn:hover:not(:disabled) { background: #0c5f59; }
.btn:disabled { opacity: 0.6; cursor: default; }
.error { margin: 0 0 12px; padding: 10px 12px; font-size: 13.5px; color: #b91c1c;
         background: #fdecec; border: 1px solid #f3c9c9; border-radius: 8px; }
.demo { margin-top: 24px; padding: 12px; text-align: center; font-size: 12px; line-height: 1.7;
        color: #6b7280; background: #fafbfc; border: 1px solid #eef0f2; border-radius: 8px; }
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
        <div className="mark" aria-hidden="true">
          {/* Колпак поварёна: пышная шапка, тулья с резинкой и складки */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5.2 13.8C1.9 13.8 1.6 9.4 4.2 8.1C4.6 4.6 8.4 3.1 10.9 5.6C11.6 5 12.4 5 13.1 5.6C15.6 3.1 19.4 4.6 19.8 8.1C22.4 9.4 22.1 13.8 18.8 13.8Z" />
            <path d="M5.6 13.8h12.8l-1 7.4H6.6Z" />
            <path d="M6.9 18.2h10.2" />
            <path d="M9.4 10.4v2.6M12 10v3.4M14.6 10.4v2.6" />
          </svg>
        </div>
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