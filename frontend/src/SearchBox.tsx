import type { ChangeEvent } from "react";

// Общая строка поиска по списку. Работает и с обычными массивами,
// и фильтрует options внутри выпадающих списков — везде, где много позиций.

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Показывать «найдено N из M» — полезно, когда список длинный
  found?: number;
  total?: number;
};

export default function SearchBox({
  value,
  onChange,
  placeholder = "Поиск…",
  found,
  total,
}: SearchBoxProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value);

  return (
    <div className="searchbox">
      <svg
        className="searchbox-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>

      <input
        type="search"
        className="searchbox-input"
        value={value}
        onChange={handle}
        placeholder={placeholder}
        autoComplete="off"
      />

      {value && (
        <button type="button" className="searchbox-clear" onClick={() => onChange("")} aria-label="Очистить">
          ×
        </button>
      )}

      {value && total !== undefined && (
        <span className="searchbox-count">
          {found} из {total}
        </span>
      )}

      <style>{css}</style>
    </div>
  );
}

// Фильтр по нескольким полям без учёта регистра и лишних пробелов
export function useFilter<T>(items: T[], query: string, fields: (item: T) => string[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const hay = fields(item).join(" ").toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
}

const css = `
.searchbox { position: relative; display: flex; align-items: center; margin-bottom: 12px; }

/* Селекторы ниже со !important намеренно: у каждой страницы свои правила
   для input (например .field input), и они сильнее обычного класса.
   Без этого лупа ложится прямо на текст. */
.searchbox .searchbox-icon {
  position: absolute; left: 12px; width: 16px; height: 16px;
  color: #9aa2ad; pointer-events: none;
}
.searchbox .searchbox-input {
  width: 100% !important;
  height: 40px !important;
  padding: 0 96px 0 36px !important;
  font-size: 14px !important;
  color: #1b1f24 !important;
  background: #fff !important;
  border: 1px solid #e7e9ec !important;
  border-radius: 8px !important;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.searchbox .searchbox-input::-webkit-search-cancel-button { display: none; }
.searchbox .searchbox-input:focus {
  border-color: #0f766e !important;
  box-shadow: 0 0 0 3px rgba(15,118,110,0.12) !important;
}
.searchbox .searchbox-clear {
  position: absolute; right: 10px; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; line-height: 1; color: #9aa2ad;
  background: transparent; border: none; cursor: pointer;
}
.searchbox .searchbox-clear:hover { color: #4b5563; }
.searchbox .searchbox-count {
  position: absolute; right: 40px; font-size: 12px; color: #9aa2ad;
  pointer-events: none;
}
`;
