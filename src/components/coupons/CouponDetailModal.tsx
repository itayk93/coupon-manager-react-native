import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useCouponUsageHistory, useDeleteTransactionRecord } from "@/hooks/useCouponUsage";

import { useActiveViewers } from "@/hooks/useActiveViewers";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import {
  Eye,
  History,
  Info,
  Banknote,
  ClipboardList,
  Barcode,
  Building2,
  CalendarDays,
  Lock,
  Tag,
  Percent,
  ShoppingCart,
  Coins,
  AlignLeft,
  Calendar,
  Store,
  Trash2,
} from "lucide-react";

type Tab = "info" | "values" | "extra";

type Props = {
  coupon: DecryptedCoupon | null;
  onClose: () => void;
  onOpenUsage?: (coupon: DecryptedCoupon) => void;
  onOpenEdit?: (coupon: DecryptedCoupon) => void;
  onOpenDelete?: (coupon: DecryptedCoupon) => void;
  onMarkUsed?: (coupon: DecryptedCoupon) => void;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ש"ח`;
}

function formatDate(value: string | null) {
  if (!value) return "ללא תוקף";
  return new Date(value).toLocaleDateString("he-IL");
}

function formatDatetime(value: string) {
  return new Date(value).toLocaleString("he-IL");
}

// Donut chart SVG component
function DonutChart({ used, total }: { used: number; total: number }) {
  const size = 180;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, total - used);
  const usedPct = total > 0 ? used / total : 0;
  const dashOffset = circumference * (1 - usedPct);

  return (
    <div className="cd-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="cd-donut-svg">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e8f5e9"
          strokeWidth={strokeWidth}
        />
        {/* Used arc */}
        {used > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e74c3c"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - circumference * usedPct}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {/* Remaining arc */}
        {remaining > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#27ae60"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset + circumference * usedPct}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="cd-donut-center">
        <span className="cd-donut-amount">₪{remaining.toFixed(2)}</span>
        <span className="cd-donut-label">נותר</span>
      </div>
      <div className="cd-donut-legend">
        <span className="cd-legend-item cd-legend-remaining">
          <span className="cd-legend-dot" style={{ background: "#27ae60" }} />
          ערך גותר
        </span>
        <span className="cd-legend-item cd-legend-used">
          <span className="cd-legend-dot" style={{ background: "#e74c3c" }} />
          ערך שנוצל
        </span>
      </div>
    </div>
  );
}

function UsageHistoryTable({ coupon }: { coupon: DecryptedCoupon }) {
  const { data: history, isLoading } = useCouponUsageHistory(coupon);
  const deleteRecord = useDeleteTransactionRecord();

  if (isLoading) {
    return (
      <div className="cd-no-data">
        <span>טוען...</span>
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="cd-no-data">
        <Info className="cd-no-data-icon" />
        <p>אין תנועות להצגה.</p>
      </div>
    );
  }

  const handleDelete = (recordId: number | string, sourceTable: 'coupon_usage' | 'coupon_transaction' | 'sum_row') => {
    if (sourceTable === 'sum_row') return;
    if (confirm("האם אתה בטוח שברצונך למחוק את הרשומה הזו?")) {
      deleteRecord.mutate({ recordId, sourceTable, couponId: coupon.id });
    }
  };

  return (
    <div className="cd-table-wrapper">
      <table className="cd-table">
        <thead>
          <tr>
            <th>
              <CalendarDays size={14} style={{ display: "inline", marginInlineEnd: 4 }} />
              תאריך
            </th>
            <th>
              <Coins size={14} style={{ display: "inline", marginInlineEnd: 4 }} />
              סכום
            </th>
            <th>
              <Info size={14} style={{ display: "inline", marginInlineEnd: 4 }} />
              פרטים
            </th>
            <th style={{ textAlign: "center", width: "60px" }}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => {
            if (h.source_table === "sum_row") {
              return (
                <tr key={`sum-${h.coupon_id}`} className="cd-sum-row font-bold bg-muted/40">
                  <td className="cd-td-date">-</td>
                  <td className="cd-td-amount text-primary" style={{ direction: "ltr" }}>
                    {formatIls(h.transaction_amount)}
                  </td>
                  <td className="cd-td-details font-bold">{h.details}</td>
                  <td style={{ textAlign: "center" }}>
                    <span className="cd-status-badge cd-status-active">סה״כ יתרה</span>
                  </td>
                </tr>
              );
            }

            const isNegative = h.transaction_amount < 0;
            return (
              <tr key={`${h.source_table}-${h.id}`}>
                <td className="cd-td-date">{h.timestamp ? formatDatetime(h.timestamp) : "-"}</td>
                <td
                  className={`cd-td-amount ${isNegative ? "cd-amount-neg" : "cd-amount-pos"}`}
                  style={{ direction: "ltr" }}
                >
                  {isNegative
                    ? `-${formatIls(Math.abs(h.transaction_amount))}`
                    : `+${formatIls(h.transaction_amount)}`}
                </td>
                <td className="cd-td-details">{h.details || "—"}</td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    title="מחק תנועה"
                    onClick={() => handleDelete(h.id, h.source_table)}
                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}



export function CouponDetailModal({
  coupon,
  onClose,
  onOpenUsage,
  onOpenEdit,
  onOpenDelete,
  onMarkUsed,
}: Props) {
  const [tab, setTab] = useState<Tab>("info");
  const { otherViewers } = useActiveViewers(coupon?.id);

  if (!coupon) return null;

  const remaining = Math.max(0, coupon.value - coupon.used_value);
  const usePct = coupon.value > 0 ? (coupon.used_value / coupon.value) * 100 : 0;
  const savePct = coupon.value > 0 ? ((coupon.value - (coupon.cost || 0)) / coupon.value) * 100 : 0;

  return (
    <Dialog open={!!coupon} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="legacy-modal-content coupon-detail-full-modal" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי קופון</DialogTitle>
        </DialogHeader>

        {/* Active viewers badge */}
        {otherViewers.length > 0 && (
          <div className="cd-viewers-badge">
            <Eye size={14} />
            <span>
              {otherViewers.length === 1 ? "משתמש נוסף צופה" : `${otherViewers.length} משתמשים נוספים צופים`} בקופון
              עכשיו
              {otherViewers[0]?.first_name
                ? ` (${otherViewers.map((v) => v.first_name).filter(Boolean).join(", ")})`
                : ""}
            </span>
          </div>
        )}

        {/* Header: logo + company name */}
        <div className="cd-header">
          <img src={getCompanyLogo(coupon.company)} alt={coupon.company} className="cd-logo" />
          <h3 className="cd-company-name">{coupon.company}</h3>
        </div>

        {/* Tabs */}
        <div className="cd-tabs">
          <button
            className={`cd-tab-btn ${tab === "info" ? "cd-tab-active" : ""}`}
            onClick={() => setTab("info")}
          >
            <Info size={15} />
            פרטי קופון
          </button>
          <button
            className={`cd-tab-btn ${tab === "values" ? "cd-tab-active" : ""}`}
            onClick={() => setTab("values")}
          >
            <Banknote size={15} />
            ערכים כספיים
          </button>
          <button
            className={`cd-tab-btn ${tab === "extra" ? "cd-tab-active" : ""}`}
            onClick={() => setTab("extra")}
          >
            <ClipboardList size={15} />
            נתונים נוספים
          </button>
        </div>

        {/* Tab content */}
        <div className="cd-tab-content">
          {/* TAB 1: coupon info */}
          {tab === "info" && (
            <div className="cd-info-grid">
              <div className="cd-info-box">
                <div className="cd-info-icon"><Barcode size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">קוד מוצר:</span>
                  <strong className="cd-info-value cd-code">{coupon.code}</strong>
                </div>
              </div>
              <div className="cd-info-box">
                <div className="cd-info-icon"><Building2 size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">חברה:</span>
                  <strong className="cd-info-value">{coupon.company}</strong>
                </div>
              </div>
              {coupon.expiration && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><CalendarDays size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">תוקף עד:</span>
                    <strong className="cd-info-value">{formatDate(coupon.expiration)}</strong>
                  </div>
                </div>
              )}
              {coupon.status && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><Tag size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">סטטוס:</span>
                    <strong
                      className={`cd-info-value cd-status-badge ${
                        coupon.status === "פעיל" ? "cd-status-active" : "cd-status-used"
                      }`}
                    >
                      {coupon.status}
                    </strong>
                  </div>
                </div>
              )}
              {coupon.card_exp && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><Calendar size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">תוקף כרטיס:</span>
                    <strong className="cd-info-value">{coupon.card_exp}</strong>
                  </div>
                </div>
              )}
              {coupon.cvv && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><Lock size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">CVV:</span>
                    <strong className="cd-info-value">{coupon.cvv}</strong>
                  </div>
                </div>
              )}
              {coupon.is_one_time && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><Tag size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">שימוש חד פעמי:</span>
                    <strong className="cd-info-value">כן</strong>
                  </div>
                </div>
              )}
              {coupon.purpose && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><AlignLeft size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">מטרה:</span>
                    <strong className="cd-info-value">{coupon.purpose}</strong>
                  </div>
                </div>
              )}
              {coupon.description && (
                <div className="cd-info-box cd-info-box-full">
                  <div className="cd-info-icon"><AlignLeft size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">תיאור:</span>
                    <span className="cd-info-value">{coupon.description}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: financial values */}
          {tab === "values" && (
            <div className="cd-values-tab">
              <DonutChart used={coupon.used_value || 0} total={coupon.value || 0} />
              <div className="cd-values-grid">
                <div className="cd-info-box cd-highlight">
                  <div className="cd-info-icon"><Tag size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">ערך מקורי:</span>
                    <strong className="cd-info-value" style={{ direction: "ltr" }}>
                      {formatIls(coupon.value || 0)}
                    </strong>
                  </div>
                </div>
                <div className="cd-info-box cd-highlight">
                  <div className="cd-info-icon"><ShoppingCart size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">ערך שהשתמשת בו:</span>
                    <strong className="cd-info-value" style={{ direction: "ltr" }}>
                      {formatIls(coupon.used_value || 0)}
                    </strong>
                  </div>
                </div>
                <div className="cd-info-box cd-highlight">
                  <div className="cd-info-icon"><Coins size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">ערך נותר:</span>
                    <strong className="cd-info-value cd-value-remaining" style={{ direction: "ltr" }}>
                      {formatIls(remaining)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: extra data */}
          {tab === "extra" && (
            <div className="cd-info-grid">
              <div className="cd-info-box">
                <div className="cd-info-icon"><CalendarDays size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">תאריך הזנה:</span>
                  <strong className="cd-info-value">
                    {coupon.date_added ? formatDatetime(coupon.date_added) : "—"}
                  </strong>
                </div>
              </div>
              <div className="cd-info-box">
                <div className="cd-info-icon"><Percent size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">אחוז שימוש:</span>
                  <strong className="cd-info-value">{usePct.toFixed(1)}%</strong>
                  <div className="cd-progress-bar">
                    <div className="cd-progress-fill" style={{ width: `${usePct}%` }} />
                  </div>
                </div>
              </div>
              <div className="cd-info-box">
                <div className="cd-info-icon"><Banknote size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">כמה שילמת על הקופון:</span>
                  <strong className="cd-info-value" style={{ direction: "ltr" }}>
                    {formatIls(coupon.cost || 0)}
                  </strong>
                </div>
              </div>
              <div className="cd-info-box">
                <div className="cd-info-icon"><Percent size={18} /></div>
                <div className="cd-info-body">
                  <span className="cd-info-label">כמה אחוז חסכת:</span>
                  <strong className="cd-info-value cd-saving">{savePct.toFixed(1)}%</strong>
                </div>
              </div>
              {coupon.source && coupon.source !== "לא צוין" && (
                <div className="cd-info-box">
                  <div className="cd-info-icon"><Store size={18} /></div>
                  <div className="cd-info-body">
                    <span className="cd-info-label">מקור הקופון:</span>
                    <strong className="cd-info-value">{coupon.source}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage history section */}
        <div className="cd-section-divider">
          <div className="cd-divider-line" />
          <History size={16} className="cd-divider-icon" />
          <div className="cd-divider-line" />
        </div>
        <h4 className="cd-history-title">היסטוריית טעינות / שימושים</h4>
        <UsageHistoryTable coupon={coupon} />

        {/* Action buttons */}
        <div className="cd-action-row cd-action-secondary">
          {onOpenUsage && coupon.status === "פעיל" && (
            <Button
              variant="outline"
              className="cd-btn-update"
              onClick={() => onOpenUsage(coupon)}
            >
              עדכון שימוש בקופון
            </Button>
          )}
          {onMarkUsed && coupon.is_one_time && coupon.status === "פעיל" && (
            <Button
              variant="destructive"
              className="cd-btn-mark-used"
              onClick={() => onMarkUsed(coupon)}
            >
              <Tag size={15} />
              סימון כנוצל
            </Button>
          )}
          {onOpenEdit && (
            <Button
              variant="outline"
              className="cd-btn-edit"
              onClick={() => onOpenEdit(coupon)}
            >
              עריכת קופון
            </Button>
          )}
        </div>
        <div className="cd-action-row cd-action-primary">
          {onOpenDelete && (
            <Button
              variant="destructive"
              className="cd-btn-delete"
              onClick={() => onOpenDelete(coupon)}
            >
              <Trash2 size={15} />
              מחק קופון
            </Button>
          )}
          <Button
            variant="outline"
            className="cd-btn-back"
            onClick={onClose}
          >
            סגירה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
