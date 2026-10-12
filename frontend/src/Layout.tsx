import type { ReactNode } from "react";

// Меню разделов по ролям — из задания бэкендера (не меняем)
export const MENU_BY_ROLE: Record<string, string[]> = {
    Manager: ["Дашборд", "Продукты", "Блюда", "Склад", "Стоп-лист", "Горячие предложения", "Журнал", "Прогноз"],
    Cook: ["Кухня", "Приёмка", "Продукты", "Склад", "Списание", "Стоп-лист", "Журнал"],
    Waiter: ["Меню", "Новый заказ", "Стоп-лист", "Мои заказы"],
};

// Стили каркаса — палитра из макета управляющий-дашборд-макет.html
const css = `
.layout { min-height: 100vh; display: flex; flex-direction: column; background: #f5f6f8; }
.topbar { height: 64px; background: #2c3d4f; display: flex; align-items: center;
          justify-content: space-between; padding: 0 24px; }
.brand { color: #fff; font-size: 21px; font-weight: 800; letter-spacing: 2px; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.user { color: #d5dde6; font-size: 14px; }
.logout { background: #47566b; color: #fff; border: none; border-radius: 6px;
          padding: 9px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
.logout:hover { background: #556782; }
.body { flex: 1; display: flex; }
.sidebar { width: 240px; background: #33495e; padding-top: 12px; flex-shrink: 0; }
.nav-item { display: block; width: 100%; text-align: left; padding: 12px 21px;
            font-size: 15px; color: #c7d3de; background: none;
            border: none; border-left: 3px solid transparent; cursor: pointer; }
.nav-item:hover { background: #3c546b; color: #fff; }
.nav-item.active { background: #3c546b; color: #fff; font-weight: 700;
                   border-left-color: #5bb0e0; }
.content { flex: 1; padding: 28px 32px; }
.stub { color: #8a94a0; font-size: 18px; }
`;

type LayoutProps = {
  fullName: string;
  role: string;
  onLogout: () => void;
  current: string;
  onSelect: (section: string) => void;
  children: ReactNode;
};

// Каркас приложения: шапка, меню по роли, рабочая область
export default function Layout({
  fullName, role, onLogout, current, onSelect, children,
}: LayoutProps) {
  // Если роли нет в списке — показываем меню управляющего
  const items = MENU_BY_ROLE[role] ?? MENU_BY_ROLE.Manager;

  return (
    <div className="layout">
      <style>{css}</style>
      <header className="topbar">
        <div className="brand">FLAGMAN</div>
        <div className="topbar-right">
          <span className="user">{fullName} • {role}</span>
          <button className="logout" onClick={onLogout}>Выйти</button>
        </div>
      </header>
      <div className="body">
        <nav className="sidebar">
          {items.map((item) => (
            <button
              key={item}
              className={item === current ? "nav-item active" : "nav-item"}
              onClick={() => onSelect(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}