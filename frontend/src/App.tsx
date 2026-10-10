import { useState } from "react";
import LoginPage from "./LoginPage";
import Layout, { MENU_BY_ROLE } from "./Layout";
import ProductsPage from "./ProductsPage";

// Текущая роль из localStorage (по умолчанию — Управляющий)
const storedRole = () => localStorage.getItem("role") ?? "Manager";

// Корневой компонент: экран входа или рабочая область
function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  // Выбранный раздел; по умолчанию — первый пункт меню текущей роли
  const [section, setSection] = useState<string>(() => (MENU_BY_ROLE[storedRole()] ?? MENU_BY_ROLE.Manager)[0]);

  // Успешный вход: LoginPage сохранил сессию — перечитываем её
  const handleSuccess = () => {
    setToken(localStorage.getItem("token"));
    setSection((MENU_BY_ROLE[storedRole()] ?? MENU_BY_ROLE.Manager)[0]);
  };

  // Выход: чистим localStorage и возвращаем на экран входа
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    setToken(null);
  };

  // Токена нет — показываем вход
  if (!token) {
    return <LoginPage onSuccess={handleSuccess} />;
  }

  // Токен есть — каркас с меню; справа рисуем выбранный раздел
  return (
    <Layout
      fullName={localStorage.getItem("fullName") ?? ""}
      role={storedRole()}
      onLogout={handleLogout}
      current={section}
      onSelect={setSection}
    >
      {section === "Продукты" ? <ProductsPage /> : <p className="stub">Раздел в разработке</p>}
    </Layout>
  );
}

export default App;