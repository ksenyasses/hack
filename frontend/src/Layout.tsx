import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./theme.css";
import { getOrdersFull, getWriteoffRequests } from "./api";

// Меню разделов по ролям — из задания бэкендера (не меняем)
export const MENU_BY_ROLE: Record<string, string[]> = {
    Manager: ["Главная", "Продукты", "Блюда", "Склад", "Стоп-лист", "Горячие предложения", "Журнал", "Прогноз", "Списания"],
    Cook: ["Кухня", "Приёмка", "Продукты", "Склад", "Списание", "Стоп-лист", "Журнал"],
    Waiter: ["Меню", "Новый заказ", "Стоп-лист", "Мои заказы"],
};

// Иконки разделов — простые контуры, цвет берётся от текста пункта.
// Поэтому у активного пункта с белым текстом иконки становятся белыми сами.
const NAV_ICONS: Record<string, string> = {
    "Главная": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    "Продукты": "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
    "Блюда": "M6 3h13v18H6zM10 3v18",
    "Склад": "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
    "Приёмка": "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6M18 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6",
    "Списание": "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
    "Списания": "M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6",
    "Стоп-лист": "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8",
    "Горячие предложения": "M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 2 2 2 2-2 2-8z",
    "Журнал": "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
    "Прогноз": "M4 19V5M4 19h16M8 16v-4M12 16V9M16 16v-6",
    "Кухня": "M7 20h10v-4a5 5 0 10-10 0zM7 16h10",
    "Меню": "M5 4h14v16H5zM9 8h6M9 12h6M9 16h4",
    "Новый заказ": "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8M8 12h8",
    "Мои заказы": "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
};

// Стили каркаса — палитра из макета управляющий-дашборд-макет.html
const css = `
.layout { min-height: 100vh; display: flex; flex-direction: column; background: #f5f6f8; }
.topbar { height: 64px; background: #2c3d4f; display: flex; align-items: center;
          justify-content: space-between; padding: 0 24px; }
.brand { color: #fff; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; white-space: nowrap; }
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

  // Счётчики уведомлений: сколько пунктов требует внимания именно этой роли.
  // Запрашиваем только то, что относится к текущей роли, и не чаще раза в 10 секунд.
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        if (role === "Cook") {
          const orders = await getOrdersFull();
          const n = orders.filter(
            (o) => o.status !== "Cancelled" && o.items.some((i) => i.status === "New")
          ).length;
          if (alive) setBadges({ "Кухня": n });
        } else if (role === "Waiter") {
          const orders = await getOrdersFull();
          const n = orders.filter(
            (o) => o.status !== "Cancelled" && o.items.some((i) => i.status === "Ready")
          ).length;
          if (alive) setBadges({ "Мои заказы": n });
        } else if (role === "Manager") {
          const reqs = await getWriteoffRequests();
          const n = reqs.filter((r) => r.status === "Pending").length;
          if (alive) setBadges({ "Списания": n });
        } else if (alive) {
          setBadges({});
        }
      } catch {
        // Счётчик — украшение: если запрос не прошёл, молча оставляем как есть
      }
    };

    tick();
    const timer = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [role]);

  return (
    <div className="layout">
      <style>{css}</style>
      <header className="topbar">
        <div className="brand">KITCHEN OPERATIONS</div>
        <div className="topbar-right">
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
              <span className="nav-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={NAV_ICONS[item] ?? "M4 5h16v14H4z"} />
                </svg>
              </span>
              <span className="nav-label">{item}</span>
              {badges[item] > 0 && (
                <span
                  className={
                    item === "Мои заказы" ? "nav-badge nav-badge-ok" : "nav-badge nav-badge-accent"
                  }
                >
                  {badges[item]}
                </span>
              )}
            </button>
          ))}

          {/* Кто вошёл — внизу меню: так шапка остаётся свободной */}
          <div className="sidebar-user">
            <span className="who">{fullName}</span>
            <span className="role">{role}</span>
          </div>
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}