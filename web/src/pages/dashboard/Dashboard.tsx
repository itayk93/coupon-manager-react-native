import { useAuth } from "@/contexts/AuthContext";
import { useCoupons } from "@/hooks/useCoupons";
import { useProfile } from "@/hooks/useProfile";
import { getCompanyLogo } from "@/lib/companyLogos";
import { BarChart3, CirclePlus, ListChecks, ReceiptText, RotateCcw, Sparkles, WalletCards, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardModalType, DashboardModals } from "@/components/dashboard/DashboardModals";

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: coupons, isLoading, isError, refetch, isRefetching } = useCoupons();
  const { data: profile } = useProfile();
  const [openModal, setOpenModal] = useState<DashboardModalType>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  // A failed load and a lost connection read the same to the query layer, but
  // they need different copy: one is ours to retry, the other is the user's to fix.
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const sync = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const visibleCoupons = (coupons || []).filter((coupon) => !coupon.is_for_sale && coupon.status !== "נוצל");
  const totalValue = visibleCoupons.reduce((sum, coupon) => sum + (coupon.value || 0), 0);
  const usedValue = visibleCoupons.reduce((sum, coupon) => sum + (coupon.used_value || 0), 0);
  const remainingValue = totalValue - usedValue;
  const totalSavings = visibleCoupons.reduce((sum, coupon) => sum + Math.max(0, (coupon.value || 0) - (coupon.cost || 0)), 0);
  const expiringSoonCount = visibleCoupons.filter((coupon) => {
    if (!coupon.expiration) return false;
    const daysLeft = (new Date(coupon.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 14;
  }).length;
  const displayName = user?.first_name || user?.email?.split("@")[0] || "משתמש";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";

  const companyPriority = [
    "Carrefour",
    "מגה ספורט",
    "GoodPharm",
    "XTRA",
    "פולגת",
    "BuyMe",
    "Dream Card",
    "Power Gift",
  ];

  const companyCards = Object.values(
    visibleCoupons.reduce<Record<string, { company: string; count: number }>>((map, coupon) => {
      const company = coupon.company || "ללא חברה";
      map[company] = map[company] || { company, count: 0 };
      map[company].count += 1;
      return map;
    }, {})
  ).sort((a, b) => {
    const priorityA = companyPriority.indexOf(a.company);
    const priorityB = companyPriority.indexOf(b.company);
    if (priorityA !== -1 || priorityB !== -1) {
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    }
    return b.count - a.count || a.company.localeCompare(b.company, "he");
  });

  return (
    <section className="dashboard-page">
      <section className="wallet-hero">
        <h1 className="sr-only">קופונים והנחות בלעדיות בישראל - חסוך כסף עכשיו!</h1>
        <div className="wallet-hero-card">
          <div className="wallet-hero-copy">
            <div className="wallet-eyebrow">
              <WalletCards size={18} />
              הארנק שלך
            </div>
            <h2>{greeting}, {displayName}</h2>
            <p>{isError ? "לא הצלחנו לטעון את הקופונים" : `${visibleCoupons.length} קופונים פעילים לניצול`}</p>
          </div>

          <div className="wallet-balance-card" aria-label="יתרה זמינה בארנק" dir="rtl">
            <span>יתרה זמינה</span>
            {/* On error the sums are all zero. Showing "0.00 ₪" would report a
                network failure as an empty wallet — say nothing instead. */}
            <strong dir="rtl">{isError ? "—" : isLoading ? "טוען..." : formatIls(remainingValue)}</strong>
            <small dir="rtl">{isError ? "היתרה תוצג לאחר טעינה מחדש" : `מתוך ${formatIls(totalValue)} בארנק`}</small>
          </div>
        </div>

        <div className="wallet-kpi-grid" aria-label="סיכום ארנק">
          <article>
            <Sparkles size={18} />
            <span>חסכת עד היום</span>
            <strong>{isLoading || isError ? "—" : formatIls(totalSavings)}</strong>
          </article>
          <article>
            <ReceiptText size={18} />
            <span>כבר נוצל</span>
            <strong>{isLoading || isError ? "—" : formatIls(usedValue)}</strong>
          </article>
          <article>
            <BarChart3 size={18} />
            <span>פגים ב-14 יום</span>
            <strong>{isLoading || isError ? "—" : expiringSoonCount}</strong>
          </article>
        </div>

        <div className="legacy-action-row wallet-action-row">
          <button type="button" className="legacy-stats-button legacy-quick-add-button" onClick={() => setOpenModal("quick-add")}>
            <CirclePlus size={19} />
            הוספת קופון מהירה
          </button>
          <button type="button" className="legacy-stats-button legacy-info-button" onClick={() => setOpenModal("stats")}>
            <ListChecks size={19} />
            על מה חסכת?
          </button>
          <button type="button" className="legacy-stats-button legacy-report-button" onClick={() => setOpenModal("usage")}>
            <CirclePlus size={19} />
            דיווח מהיר על שימוש
          </button>
        </div>
      </section>

      <section className="company-cards-row" aria-label="חברות עם קופונים פעילים">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, index) => <div className="company-card-box skeleton-card" key={index} />)
        ) : isError ? (
          /* Without this branch a failed fetch fell through to the empty state,
             telling the user their wallet was empty when the network was down. */
          <div className="legacy-empty-state" role="alert">
            {isOffline ? <WifiOff size={34} aria-hidden="true" /> : <BarChart3 size={34} aria-hidden="true" />}
            <h3>{isOffline ? "אין חיבור לאינטרנט." : "לא הצלחנו לטעון את הקופונים."}</h3>
            <p>
              {isOffline
                ? "הקופונים שלך שמורים. הם יוצגו כאן ברגע שהחיבור יחזור."
                : "הקופונים שלך שמורים ולא אבדו — רק הטעינה נכשלה."}
            </p>
            <button
              type="button"
              className="legacy-stats-button legacy-quick-add-button"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RotateCcw size={19} aria-hidden="true" />
              {isRefetching ? "טוען מחדש..." : "נסה שוב"}
            </button>
          </div>
        ) : companyCards.length > 0 ? (
          companyCards.map((card) => (
            <article
              className="company-card-box"
              key={card.company}
              role="button"
              tabIndex={0}
              aria-label={`פתיחת קופונים של ${card.company}`}
              onClick={() => {
                setSelectedCompany(card.company);
                setOpenModal("company");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedCompany(card.company);
                  setOpenModal("company");
                }
              }}
            >
              <img src={getCompanyLogo(card.company)} alt={card.company} />
              <h3>{card.company}</h3>
              <p>{card.count} קופונים פעילים</p>
            </article>
          ))
        ) : (
          <div className="legacy-empty-state">
            <BarChart3 size={34} />
            <h3>אין קופונים פעילים.</h3>
            <p>ברגע שתוסיף קופונים, הם יוצגו כאן לפי חברה בדיוק כמו באתר הישן.</p>
          </div>
        )}
      </section>

      <DashboardModals openModal={openModal} onOpenChange={setOpenModal} coupons={coupons || []} selectedCompany={selectedCompany} />
    </section>
  );
}
