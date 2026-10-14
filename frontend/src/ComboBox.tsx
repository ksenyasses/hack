import { useEffect, useMemo, useRef, useState } from "react";

// Поле ввода со списком подсказок: вместо выпадающего списка, где
// приходится прокручивать, пишешь первую букву — и сразу видишь подходящее.
// Работает мышью и с клавиатуры.

// Ищем только по названию: единицу измерения в поиск не берём, иначе
// буква «к» совпадёт с «кг» у каждого продукта подряд.
// Ранг решает, в каком порядке показывать:
//   0 — начинается с запроса («Курица» на «к»)
//   1 — начинается новое слово внутри названия («Творожная каша» на «ка»)
//   2 — запрос просто встречается («Гречка» на «к»)
//   -1 — не подходит совсем
function rankOption(label: string, q: string): number {
  const hay = label.toLowerCase();
  if (hay.startsWith(q)) return 0;

  let sawInsideWord = false;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(q, from);
    if (i < 0) break;
    const before = i === 0 ? "" : hay[i - 1];
    if (!/[a-zа-яё0-9]/.test(before)) return 1; // начало слова
    sawInsideWord = true; // «Гречка» на «к» — нашлось, но не с начала слова
    from = i + 1;
  }
  return sawInsideWord ? 2 : -1;
}

export type ComboOption = {
  value: string;
  label: string;
  // Подпись серым справа: единица измерения, остаток и т.п.
  hint?: string;
};

type ComboBoxProps = {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
};

export default function ComboBox({
  options,
  value,
  onChange,
  placeholder = "Начните вводить название",
  emptyText = "Ничего не найдено",
  disabled,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Пока список закрыт и значение выбрано — показываем его название.
  // Как только открыли для правки — показываем то, что печатает человек.
  const shown = open ? text : selected?.label ?? "";

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return options;
    return options
      .map((o) => ({ o, rank: rankOption(o.label, q) }))
      .filter((r) => r.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.o.label.localeCompare(b.o.label, "ru"))
      .map((r) => r.o);
  }, [options, text]);

  // Клик мимо — закрываем список. Слушатель на документ, а не на blur,
  // иначе клик по варианту успевает закрыть список до выбора.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (opt: ComboOption) => {
    onChange(opt.value);
    setOpen(false);
    setText("");
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        choose(filtered[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        setOpen(false);
        setText("");
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  // Подсветить найденный кусок слова — видно, почему вариант подошёл
  const mark = (label: string) => {
    const q = text.trim().toLowerCase();
    if (!q) return label;
    const i = label.toLowerCase().indexOf(q);
    if (i < 0) return label;
    return (
      <>
        {label.slice(0, i)}
        <b>{label.slice(i, i + q.length)}</b>
        {label.slice(i + q.length)}
      </>
    );
  };

  return (
    <div className="combo" ref={rootRef}>
      <div className="combo-field">
        <input
          type="text"
          className="combo-input"
          value={shown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            setText("");
            setActive(0);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />

        {value && !disabled && (
          <button
            type="button"
            className="combo-clear"
            onClick={() => {
              onChange("");
              setText("");
              setOpen(true);
            }}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="combo-list" role="listbox">
          {filtered.length === 0 && <div className="combo-empty">{emptyText}</div>}

          {filtered.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={
                "combo-item" + (i === active ? " combo-item-active" : "") +
                (opt.value === value ? " combo-item-sel" : "")
              }
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              <span className="combo-label">{mark(opt.label)}</span>
              {opt.hint && <span className="combo-hint">{opt.hint}</span>}
            </button>
          ))}
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
.combo { position: relative; }

/* Поле ввода. Правила с !important: у страниц свои стили для input,
   и без этого они перебивают отступы под иконку и рамку. */
.combo .combo-field { position: relative; }
.combo .combo-input {
  width: 100% !important;
  height: 42px !important;
  padding: 0 34px 0 12px !important;
  font-size: 14px !important;
  color: #1b1f24 !important;
  background: #fff !important;
  border: 1px solid #e7e9ec !important;
  border-radius: 8px !important;
  outline: none;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.combo .combo-input:focus {
  border-color: #0f766e !important;
  box-shadow: 0 0 0 3px rgba(15,118,110,0.12) !important;
  cursor: text;
}
.combo .combo-input::placeholder { color: #9aa2ad; }

.combo .combo-clear {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; display: flex; align-items: center;
  justify-content: center; font-size: 18px; line-height: 1;
  color: #9aa2ad; background: transparent; border: none; cursor: pointer;
}
.combo .combo-clear:hover { color: #4b5563; }

.combo .combo-list {
  position: absolute; z-index: 40; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 264px; overflow-y: auto;
  background: #fff; border: 1px solid #e7e9ec; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(16,24,40,0.12);
  padding: 4px;
}

.combo .combo-item {
  display: flex; align-items: baseline; gap: 10px; width: 100%;
  text-align: left; padding: 9px 10px;
  font-size: 14px; color: #1b1f24;
  background: transparent; border: none; border-radius: 6px; cursor: pointer;
}
.combo .combo-item:hover,
.combo .combo-item-active { background: #e6f2f1; }
.combo .combo-item-sel { color: #0f766e; font-weight: 600; }
.combo .combo-label { flex: 0 1 auto; min-width: 0; }
.combo .combo-label b { font-weight: 700; color: #0f766e; }
/* Единица и остаток прижаты вправо: так название читается как текст,
   а не слипается с «кг» без пробела. */
.combo .combo-hint {
  margin-left: auto; flex: 0 0 auto;
  font-size: 12px; color: #9aa2ad; white-space: nowrap;
}

.combo .combo-empty { padding: 12px 10px; font-size: 13px; color: #9aa2ad; }
`;
