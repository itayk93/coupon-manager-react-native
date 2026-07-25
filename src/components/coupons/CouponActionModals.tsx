import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecryptedCoupon, useDeleteCoupon, useUpdateCoupon } from "@/hooks/useCoupons";
import { useRecordUsage } from "@/hooks/useCouponUsage";
import { getCompanyLogo } from "@/lib/companyLogos";
import { CouponDetailModal } from "@/components/coupons/CouponDetailModal";


type CouponActionModalsProps = {
  detailsCoupon: DecryptedCoupon | null;
  codeCoupon: DecryptedCoupon | null;
  usageCoupon: DecryptedCoupon | null;
  deleteCoupon: DecryptedCoupon | null;
  markUsedCoupon: DecryptedCoupon | null;
  onDetailsChange: (coupon: DecryptedCoupon | null) => void;
  onCodeChange: (coupon: DecryptedCoupon | null) => void;
  onUsageChange: (coupon: DecryptedCoupon | null) => void;
  onDeleteChange: (coupon: DecryptedCoupon | null) => void;
  onMarkUsedChange: (coupon: DecryptedCoupon | null) => void;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

function formatDate(value: string | null) {
  if (!value) return "ללא תוקף";
  return new Date(value).toLocaleDateString("he-IL");
}

export function CouponActionModals({
  detailsCoupon,
  codeCoupon,
  usageCoupon,
  deleteCoupon,
  markUsedCoupon,
  onDetailsChange,
  onCodeChange,
  onUsageChange,
  onDeleteChange,
  onMarkUsedChange,
}: CouponActionModalsProps) {
  const updateCoupon = useUpdateCoupon();
  const recordUsage = useRecordUsage();
  const deleteCouponMutation = useDeleteCoupon();
  const [usageAmount, setUsageAmount] = useState("");
  const [usageError, setUsageError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingUsed, setIsMarkingUsed] = useState(false);

  const remaining = usageCoupon ? Math.max(0, usageCoupon.value - usageCoupon.used_value) : 0;

  const closeUsage = () => {
    onUsageChange(null);
    setUsageAmount("");
    setUsageError("");
  };

  const submitUsage = async () => {
    if (!usageCoupon) return;
    const amount = Number(usageAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setUsageError("אנא הזן סכום חוקי (> 0).");
      return;
    }
    if (amount > remaining) {
      setUsageError(`הסכום שהוזן חורג מהיתרה הקיימת (${remaining.toFixed(2)} ש"ח).`);
      return;
    }

    setUsageError("");
    setIsSubmitting(true);
    try {
      await recordUsage.mutateAsync({ couponId: usageCoupon.id, usedAmount: amount });
      closeUsage();
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFullUsage = async () => {
    if (!usageCoupon) return;
    if (remaining <= 0) {
      setUsageError("אין יתרה לעדכון.");
      return;
    }

    setUsageError("");
    setIsSubmitting(true);
    try {
      await recordUsage.mutateAsync({ couponId: usageCoupon.id, usedAmount: remaining, details: "עדכון כל היתרה" });
      closeUsage();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCoupon) return;
    setIsDeleting(true);
    try {
      await deleteCouponMutation.mutateAsync(deleteCoupon.id);
      onDeleteChange(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmMarkUsed = async () => {
    if (!markUsedCoupon) return;
    setIsMarkingUsed(true);
    try {
      await updateCoupon.mutateAsync({
        id: markUsedCoupon.id,
        updates: {
          used_value: markUsedCoupon.value || 0,
          status: "נוצל",
        },
      });
      toast.success('הקופון סומן בהצלחה כ"נוצל לגמרי".');
      onMarkUsedChange(null);
    } finally {
      setIsMarkingUsed(false);
    }
  };

  return (
    <>
      <CouponDetailModal
        coupon={detailsCoupon}
        onClose={() => onDetailsChange(null)}
        onOpenUsage={onUsageChange}
        onOpenDelete={onDeleteChange}
        onMarkUsed={onMarkUsedChange}
      />

      <Dialog open={!!codeCoupon} onOpenChange={(open) => !open && onCodeChange(null)}>
        <DialogContent className="legacy-modal-content big-code-modal-react" dir="rtl">
          {codeCoupon && (
            <div className="big-code-content">
              <h2>{codeCoupon.company}</h2>
              <img src={getCompanyLogo(codeCoupon.company)} alt={codeCoupon.company} />
              <h1>{codeCoupon.code}</h1>
              {(codeCoupon.cvv || codeCoupon.card_exp) && (
                <div className="big-code-extra">
                  {codeCoupon.cvv && <h2>{codeCoupon.cvv} :CVV</h2>}
                  {codeCoupon.card_exp && <h2>תוקף: {codeCoupon.card_exp}</h2>}
                </div>
              )}
              <div className="big-code-qr" aria-label="QR code">
                <QRCodeSVG value={codeCoupon.code || " "} size={180} level="H" includeMargin />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageCoupon} onOpenChange={(open) => !open && closeUsage()}>
        <DialogContent className="legacy-modal-content company-usage-modal-react" dir="rtl">
          {usageCoupon && (
            <div className="company-usage-content">
              <h3>עדכון סכום שימוש</h3>
              <h2>חברה: {usageCoupon.company}</h2>
              <img src={getCompanyLogo(usageCoupon.company)} alt={usageCoupon.company} />
              <p><strong>קוד קופון: {usageCoupon.code}</strong></p>
              <p><strong>יתרה נוכחית: {formatIls(remaining)}</strong></p>
              <Input
                type="number"
                step="0.01"
                placeholder="בכמה השתמשת?"
                value={usageAmount}
                onChange={(event) => setUsageAmount(event.target.value)}
              />
              {usageError && <p className="legacy-field-error">{usageError}</p>}
              <div className="legacy-modal-actions">
                <Button type="button" onClick={submitUsage} disabled={isSubmitting}>אישור</Button>
                <Button type="button" variant="outline" onClick={submitFullUsage} disabled={isSubmitting}>
                  עדכון כל היתרה
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCoupon} onOpenChange={(open) => !open && onDeleteChange(null)}>
        <DialogContent className="legacy-modal-content coupon-delete-modal-react" dir="rtl">
          {deleteCoupon && (
            <>
              <DialogHeader>
                <DialogTitle>אישור מחיקת קופון</DialogTitle>
              </DialogHeader>
              <div className="coupon-delete-content">
                <img src={getCompanyLogo(deleteCoupon.company)} alt={deleteCoupon.company} />
                <h3>{deleteCoupon.company}</h3>
                <p>האם אתה בטוח שברצונך למחוק קופון זה?</p>
                <p className="coupon-delete-code">קוד: {deleteCoupon.code}</p>
                <div className="legacy-modal-actions">
                  <Button type="button" variant="outline" onClick={() => onDeleteChange(null)} disabled={isDeleting}>
                    ביטול
                  </Button>
                  <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                    {isDeleting ? "מוחק..." : "אשר מחיקה"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!markUsedCoupon} onOpenChange={(open) => !open && onMarkUsedChange(null)}>
        <DialogContent className="legacy-modal-content coupon-delete-modal-react" dir="rtl">
          {markUsedCoupon && (
            <>
              <DialogHeader>
                <DialogTitle>סימון הקופון כנוצל</DialogTitle>
              </DialogHeader>
              <div className="coupon-delete-content">
                <img src={getCompanyLogo(markUsedCoupon.company)} alt={markUsedCoupon.company} />
                <h3>{markUsedCoupon.company}</h3>
                <p>האם אתה בטוח שברצונך לסמן קופון זה כנוצל?</p>
                <p className="coupon-delete-code">קוד: {markUsedCoupon.code}</p>
                <div className="legacy-modal-actions">
                  <Button type="button" variant="outline" onClick={() => onMarkUsedChange(null)} disabled={isMarkingUsed}>
                    ביטול
                  </Button>
                  <Button type="button" variant="destructive" onClick={confirmMarkUsed} disabled={isMarkingUsed}>
                    {isMarkingUsed ? "מסמן..." : "אשר סימון כנוצל"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
