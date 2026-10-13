import { useState } from "react";
import LoginPage from "./LoginPage";
import Layout, { MENU_BY_ROLE } from "./Layout";
import DashboardPage from "./DashboardPage";
import ProductsPage from "./ProductsPage";
import StockPage from "./StockPage";
import DeliveryPage from "./DeliveryPage";
import DishesPage from "./DishesPage";
import NewOrderPage from "./NewOrderPage";
import MenuPage from "./MenuPage";
import StopListPage from "./StopListPage";
import WriteOffPage from "./WriteOffPage";
import WriteOffReviewPage from "./WriteOffReviewPage";
import HotOffersPage from "./HotOffersPage";
import JournalPage from "./JournalPage";
import MyOrdersPage from "./MyOrdersPage";
import KitchenPage from "./KitchenPage";
import ForecastPage from "./ForecastPage";

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

  // Какой раздел рисуем в рабочей области
  const renderSection = () => {
    if (section === "Дашборд") return <DashboardPage />;
    if (section === "Продукты") return <ProductsPage />;
    if (section === "Блюда") return <DishesPage />;
    if (section === "Склад") return <StockPage />;
    if (section === "Приёмка") return <DeliveryPage />;
    if (section === "Списание") return <WriteOffPage />;
    if (section === "Списания") return <WriteOffReviewPage />;
    if (section === "Стоп-лист") return <StopListPage />;
    if (section === "Горячие предложения") return <HotOffersPage />;
    if (section === "Журнал") return <JournalPage />;
    if (section === "Прогноз") return <ForecastPage />;
    if (section === "Кухня") return <KitchenPage />;
    if (section === "Новый заказ") return <NewOrderPage />;
    if (section === "Мои заказы") return <MyOrdersPage />;
    if (section === "Меню") return <MenuPage />;
    return <p className="stub">Раздел в разработке</p>;
  };

  // Токен есть — каркас с меню; справа рисуем выбранный раздел
  return (
    <Layout
      fullName={localStorage.getItem("fullName") ?? ""}
      role={storedRole()}
      onLogout={handleLogout}
      current={section}
      onSelect={setSection}
    >
      {renderSection()}
    </Layout>
  );
}

export default App;