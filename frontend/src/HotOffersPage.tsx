import { useEffect, useState } from "react";
import { getHotOffers, setDishPromo } from "./api";
import type { HotOffersData, HotOffer } from "./api";

// Стили — из карточки горячих предложений на дашборде (DashboardPage.tsx)
const css = `
.page-title { font-size: 22px; font-weight: 700; margin: 0; color: #1f2b38; }
.page-sub { font-size: 13.5px; color: #7b8794; margin: 7px 0 0; max-width: 780px;
            line-height: 1.5; }
.card { background: #fff; border: 1px solid #e6e9ee; border-radius: 12px; padding: 18px 20px; }
.hot { border: 1px solid #f3d3bd; border-left: 4px solid #e4692a;
       background: linear-gradient(180deg, #fffdfb 0%, #ffffff 60%);
       margin-bottom: 18px; }
.card-head { display: flex; align-items: center; justify-content: space-between;
             margin-bottom: 14px; }
.card-head .title { display: flex; align-items: center; gap: 9px;
                    font-size: 15px; font-weight: 700; color: #1f2b38; }
.flame { font-size: 18px; }
.tagline { font-size: 12.5px; color: #7b8794; margin-top: 3px; }
.hot-summary { margin-left: auto; font-size: 12px; background: #fdf1dd;
               border: 1px solid #f3ddb6; color: #a5701f;
               padding: 4px 10px; border-radius: 999px; font-weight: 600; }
.hot-row { display: flex; align-items: center; gap: 14px;
           padding: 12px 0; border-top: 1px solid #e6e9ee; }
.hot-row:first-of-type { border-top: none; }
.hot-dish { font-size: 14px; font-weight: 600; min-width: 150px; color: #1f2b38; }
.hot-reason { font-size: 12.5px; color: #7b8794; flex: 1; }
.pill { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
        white-space: nowrap; }
.pill-high { background: #fbe9e8; color: #d0342c; }
.pill-mid { background: #fdf1dd; color: #a5701f; }
.pill-promo { background: #e9f7ef; color: #2f9e63; border: 1px solid #bfe8cf; }
.pill-stop { background: #fbe9e8; color: #d0342c; }
.prio { font-size: 11.5px; color: #7b8794; white-space: nowrap; }
.prio b { color: #1f2b38; font-size: 13px; }
.hot-act { background: #e4692a; color: #fff; border: none; border-radius: 8px;
           padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
           white-space: nowrap; }
.hot-act:hover:not(:disabled) { background: #cf5c20; }
.hot-act.ghost { background: #fff; color: #e4692a; border: 1px solid #f0c3a4; }
.hot-act.ghost:hover { background: #fdf3ec; }
.hot-act:disabled { opacity: 0.6; cursor: default; }
.empty-note { font-size: 12px; color: #7b8794; padding-top: 10px; }
.loading { font-size: 16px; color: #7b8794; }
.error { color: #d0342c; font-size: 14px; margin: 0 0 16px; }
`;

// Склонение: «1 блюдо», «2 блюда», «5 блюд»
function dishesWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (last === 1 && abs !== 11) return "блюдо";
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return "блюда";
  return "блюд";
}

// 6.37 -> "6,370"
function fmtQty(q: number): string {
  return q.toFixed(3).replace(".", ",");
}

// 22.5 -> "22,5"
function fmtPriority(p: number): string {
  return String(p).replace(".", ",");
}

// "2026-10-08" -> "08.10"
function fmtDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}`;
}

// Раздел «Горячие предложения» для управляющего
export default function HotOffersPage() {
  const [data, setData] = useState<HotOffersData>({ offers: [], toWriteOff: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // id блюда, по которому прямо сейчас жмут кнопку
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getHotOffers());
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось загрузить предложения");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Включить или снять «Блюдо дня». Формат запроса — тот же, что на дашборде
  const togglePromo = async (offer: HotOffer) => {
    const today = new Date().toISOString().slice(0, 10); // "ГГГГ-ММ-ДД"
    const next = !offer.isPromo;
    setBusyId(offer.id);
    try {
      await setDishPromo(offer.id, next ? today : null);
      // Обновляем только эту строку в списке
      setData((prev) => ({
        ...prev,
        offers: prev.offers.map((o) => (o.id === offer.id ? { ...o, isPromo: next } : o)),
      }));
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error ?? e.message ?? "Не удалось изменить акцию");
    } finally {
      setBusyId(null);
    }
  };

  const { offers, toWriteOff } = data;

  return (
    <div>
      <style>{css}</style>
      <h1 className="page-title">Горячие предложения</h1>
      <p className="page-sub">
        Блюда, в которые уходят продукты с истекающим сроком. Чем меньше дней
        до срока у продукта и чем больше его в блюде, тем выше приоритет.
      </p>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Загрузка…</p>}

      {!loading && (
        <>
          {/* Что продавать сегодня */}
          <section className="card hot">
            <div className="card-head">
              <div>
                <div className="title">
                  <span className="flame">🔥</span> Что продавать сегодня
                  <span className="hot-summary">
                    {offers.length} {dishesWord(offers.length)}
                  </span>
                </div>
                <div className="tagline">
                  Рекомендации пересчитываются на лету — список обновляется сам
                  после любой приёмки, заказа или списания.
                </div>
              </div>
            </div>

            {offers.map((offer) => (
              <div className="hot-row" key={offer.id}>
                <div className="hot-dish">{offer.name}</div>
                <div className="hot-reason">{offer.reason}</div>

                <span className="prio">
                  Приоритет <b>{fmtPriority(offer.priority)}</b>
                </span>

                {offer.isPromo ? (
                  <>
                    <span className="pill pill-promo">Блюдо дня</span>
                    <button
                      className="hot-act ghost"
                      onClick={() => togglePromo(offer)}
                      disabled={busyId === offer.id}
                    >
                      Снять с акции
                    </button>
                  </>
                ) : (
                  <>
                    <span className={offer.priority >= 15 ? "pill pill-high" : "pill pill-mid"}>
                      {offer.priority >= 15 ? "Высокий" : "Средний"}
                    </span>
                    <button
                      className="hot-act"
                      onClick={() => togglePromo(offer)}
                      disabled={busyId === offer.id}
                    >
                      {busyId === offer.id ? "Сохраняем…" : "В акцию"}
                    </button>
                  </>
                )}
              </div>
            ))}

            {offers.length === 0 && (
              <div className="empty-note">
                Нет блюд под предложение — срочных продуктов на складе нет.
              </div>
            )}
          </section>

          {/* Просрочка уходит не в продажу, а в списание */}
          <section className="card">
            <div className="card-head">
              <div className="title">Просрочено — к списанию</div>
            </div>

            {toWriteOff.map((b) => (
              <div className="hot-row" key={b.productId}>
                <div className="hot-dish">{b.productName}</div>
                <div className="hot-reason">
                  срок {fmtDate(b.expiryDate)} · просрочено на {b.daysOverdue} дн.
                </div>
                <span className="prio">
                  Количество <b>{fmtQty(b.quantity)} {b.unit}</b>
                </span>
                <span className="pill pill-stop">Не продаём</span>
              </div>
            ))}

            {toWriteOff.length === 0 && (
              <div className="empty-note">Просроченных продуктов нет.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}