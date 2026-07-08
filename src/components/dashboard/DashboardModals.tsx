import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BarChart3, CheckCircle2, Eye, MessageCircle, Pencil, PieChart as PieChartIcon, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DecryptedCoupon, useAddCoupon, useUpdateCoupon } from "@/hooks/useCoupons";
import { getCompanyLogo } from "@/lib/companyLogos";

type DashboardModalType = "stats" | "usage" | "quick-add" | "company" | "whatsapp" | null;

type DashboardModalsProps = {
  openModal: DashboardModalType;
  onOpenChange: (modal: DashboardModalType) => void;
  coupons: DecryptedCoupon[];
  selectedCompany?: string | null;
};

const quickAddSchema = z.object({
  company: z.string().min(1, "יש לבחור או להזין חברה"),
  code: z.string().min(1, "קוד קופון הוא שדה חובה"),
  cost: z.coerce.number().min(0, "עלות חייבת להיות חיובית"),
  value: z.coerce.number().min(0, "שווי חייב להיות חיובי"),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
  expiration: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  include_card_info: z.boolean().default(false),
  cvv: z.string().optional(),
  card_exp: z.string().optional(),
  is_one_time: z.boolean().default(false),
  purpose: z.string().optional(),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

type ParsedUsageRow = {
  id: string;
  checked: boolean;
  detectedCompany: string;
  couponId: string;
  amount: string;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

function formatDate(value: string | null) {
  if (!value) return "ללא תוקף";
  return new Date(value).toLocaleDateString("he-IL");
}

export function DashboardModals({ openModal, onOpenChange, coupons, selectedCompany }: DashboardModalsProps) {
  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const [quickStep, setQuickStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailsCoupon, setDetailsCoupon] = useState<DecryptedCoupon | null>(null);
  const [codeCoupon, setCodeCoupon] = useState<DecryptedCoupon | null>(null);
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [companyUsageAmount, setCompanyUsageAmount] = useState("");
  const [companyUsageError, setCompanyUsageError] = useState("");
  const [usageText, setUsageText] = useState("");
  const [usageRows, setUsageRows] = useState<ParsedUsageRow[] | null>(null);
  const [usageReportError, setUsageReportError] = useState("");

  const activeCoupons = useMemo(
    () => coupons.filter((coupon) => !coupon.is_for_sale && coupon.status !== "נוצל"),
    [coupons]
  );

  const companyOptions = useMemo(
    () => Array.from(new Set(coupons.map((coupon) => coupon.company).filter(Boolean))).sort((a, b) => a.localeCompare(b, "he")),
    [coupons]
  );

  const quickForm = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      company: "",
      code: "",
      cost: 0,
      value: 0,
      discount_percentage: 0,
      expiration: "",
      description: "",
      source: "",
      include_card_info: false,
      cvv: "",
      card_exp: "",
      is_one_time: false,
      purpose: "",
    },
  });

  const stats = useMemo(() => {
    const byCompany: Record<string, { company: string; savings: number; value: number; remaining: number; count: number; active: number; used: number }> = {};
    let totalSavings = 0;
    let totalValue = 0;
    let remainingValue = 0;

    coupons.forEach((coupon) => {
      const company = coupon.company || "ללא חברה";
      const value = coupon.value || 0;
      const cost = coupon.cost || 0;
      const used = coupon.used_value || 0;
      const remaining = Math.max(0, value - used);
      const savings = Math.max(0, value - cost);

      byCompany[company] ||= { company, savings: 0, value: 0, remaining: 0, count: 0, active: 0, used: 0 };
      byCompany[company].savings += savings;
      byCompany[company].value += value;
      byCompany[company].remaining += remaining;
      byCompany[company].count += 1;
      if (coupon.status === "נוצל") byCompany[company].used += 1;
      else byCompany[company].active += 1;

      totalSavings += savings;
      totalValue += value;
      remainingValue += remaining;
    });

    const companies = Object.values(byCompany).sort((a, b) => b.savings - a.savings);
    const activeCount = coupons.filter((coupon) => coupon.status !== "נוצל").length;
    const usageAverage = totalValue > 0 ? ((totalValue - remainingValue) / totalValue) * 100 : 0;

    return {
      companies,
      totalSavings,
      totalValue,
      totalCoupons: coupons.length,
      activeCount,
      usageAverage,
      percentageSavings: totalValue > 0 ? (totalSavings / totalValue) * 100 : 0,
    };
  }, [coupons]);

  const selectedCompanyCoupons = activeCoupons.filter((coupon) => coupon.company === selectedCompany);
  const selectedCompanyRemaining = selectedCompanyCoupons.reduce((sum, coupon) => sum + Math.max(0, coupon.value - coupon.used_value), 0);
  const watchedQuick = quickForm.watch();
  const discount = watchedQuick.value > 0 ? Math.max(0, ((watchedQuick.value - watchedQuick.cost) / watchedQuick.value) * 100) : 0;

  const closeModal = () => {
    onOpenChange(null);
    setQuickStep(1);
    setUsageRows(null);
    setUsageReportError("");
  };

  const submitQuickAdd = async (data: QuickAddValues) => {
    setIsSubmitting(true);
    try {
      await addCoupon.mutateAsync({
        company: data.company,
        code: data.code,
        cost: data.cost,
        value: data.value,
        used_value: 0,
        description: data.description || null,
        source: data.source || null,
        expiration: data.expiration ? new Date(data.expiration).toISOString() : null,
        cvv: data.include_card_info ? data.cvv || null : null,
        card_exp: data.include_card_info ? data.card_exp || null : null,
        is_one_time: data.is_one_time,
        purpose: data.is_one_time ? data.purpose || null : null,
        status: "פעיל",
        date_added: new Date().toISOString(),
      });
      quickForm.reset();
      closeModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseUsageText = () => {
    const text = usageText.trim();
    if (!text) {
      setUsageReportError("לא הוזן טקסט.");
      return;
    }

    if (!activeCoupons.length) {
      setUsageReportError("אין לך קופונים פעילים שניתן להשתמש בהם.");
      return;
    }

    const amountMatches = Array.from(text.matchAll(/(\d+(?:[.,]\d{1,2})?)/g)).map((match) => Number(match[1].replace(",", ".")));
    const rows: ParsedUsageRow[] = [];
    const normalizedText = text.toLowerCase();

    activeCoupons.forEach((coupon) => {
      const company = coupon.company || "";
      if (!company || !normalizedText.includes(company.toLowerCase())) return;
      const companyIndex = normalizedText.indexOf(company.toLowerCase());
      const nearbyText = text.slice(companyIndex, companyIndex + 80);
      const nearbyAmount = nearbyText.match(/(\d+(?:[.,]\d{1,2})?)/);
      const amount = nearbyAmount ? Number(nearbyAmount[1].replace(",", ".")) : amountMatches[rows.length] || 0;

      rows.push({
        id: `${coupon.id}-${rows.length}`,
        checked: true,
        detectedCompany: company,
        couponId: String(coupon.id),
        amount: amount > 0 ? amount.toFixed(2) : "0.00",
      });
    });

    if (!rows.length && amountMatches.length) {
      const fallbackCoupon = activeCoupons[0];
      rows.push({
        id: `${fallbackCoupon.id}-0`,
        checked: true,
        detectedCompany: "לא זוהתה חברה",
        couponId: String(fallbackCoupon.id),
        amount: amountMatches[0].toFixed(2),
      });
    }

    if (!rows.length) {
      setUsageReportError("לא זוהו שימושים בקופונים מהטקסט שהוזן.");
      return;
    }

    setUsageReportError("");
    setUsageRows(rows);
  };

  const updateUsageRow = (rowId: string, updates: Partial<ParsedUsageRow>) => {
    setUsageRows((rows) => rows?.map((row) => (row.id === rowId ? { ...row, ...updates } : row)) || null);
  };

  const submitParsedUsages = async () => {
    const selectedRows = (usageRows || []).filter((row) => row.checked);
    if (!selectedRows.length) {
      setUsageReportError("לא נבחרו שימושים לעדכון.");
      return;
    }

    setIsSubmitting(true);
    setUsageReportError("");
    try {
      for (const row of selectedRows) {
        const coupon = activeCoupons.find((item) => String(item.id) === row.couponId);
        const amount = Number(row.amount);
        if (!coupon) throw new Error("לא נבחר קופון תקין.");
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("הסכום חייב להיות גדול מאפס.");

        const remaining = Math.max(0, coupon.value - coupon.used_value);
        if (amount > remaining) {
          throw new Error(`ניסית להשתמש ב-${amount.toFixed(2)} ₪ בקופון ${coupon.code}, אך נותרו רק ${remaining.toFixed(2)} ₪`);
        }

        const nextUsedValue = Math.min((coupon.used_value || 0) + amount, coupon.value || 0);
        await updateCoupon.mutateAsync({
          id: coupon.id,
          updates: {
            used_value: nextUsedValue,
            status: coupon.value > 0 && nextUsedValue >= coupon.value ? "נוצל" : coupon.status,
          },
        });
      }

      toast.success("השימושים עודכנו בהצלחה");
      setUsageText("");
      setUsageRows(null);
      closeModal();
    } catch (error: any) {
      setUsageReportError(error.message || "אירעה שגיאה בעדכון השימושים.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCompanyUsage = async () => {
    if (!usageCoupon) return;

    const amount = Number(companyUsageAmount);
    const remaining = Math.max(0, usageCoupon.value - usageCoupon.used_value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCompanyUsageError("אנא הזן סכום חוקי (> 0).");
      return;
    }
    if (amount > remaining) {
      setCompanyUsageError(`הסכום שהוזן חורג מהיתרה הקיימת (${remaining.toFixed(2)} ש"ח).`);
      return;
    }

    setCompanyUsageError("");
    setIsSubmitting(true);
    try {
      const nextUsedValue = Math.min((usageCoupon.used_value || 0) + amount, usageCoupon.value || 0);
      await updateCoupon.mutateAsync({
        id: usageCoupon.id,
        updates: {
          used_value: nextUsedValue,
          status: usageCoupon.value > 0 && nextUsedValue >= usageCoupon.value ? "נוצל" : usageCoupon.status,
        },
      });
      toast.success("השימוש עודכן בהצלחה");
      setDetailsCoupon((coupon) =>
        coupon?.id === usageCoupon.id
          ? {
              ...coupon,
              used_value: nextUsedValue,
              status: usageCoupon.value > 0 && nextUsedValue >= usageCoupon.value ? "נוצל" : coupon.status,
            }
          : coupon
      );
      setCodeCoupon((coupon) =>
        coupon?.id === usageCoupon.id
          ? {
              ...coupon,
              used_value: nextUsedValue,
              status: usageCoupon.value > 0 && nextUsedValue >= usageCoupon.value ? "נוצל" : coupon.status,
            }
          : coupon
      );
      setUsageCoupon(null);
      setCompanyUsageAmount("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCompanyFullUsage = async () => {
    if (!usageCoupon) return;
    const remaining = Math.max(0, usageCoupon.value - usageCoupon.used_value);
    if (remaining <= 0) {
      setCompanyUsageError("אין יתרה לעדכון.");
      return;
    }

    setCompanyUsageError("");
    setIsSubmitting(true);
    try {
      await updateCoupon.mutateAsync({
        id: usageCoupon.id,
        updates: {
          used_value: usageCoupon.value || 0,
          status: "נוצל",
        },
      });
      toast.success("השימוש עודכן בהצלחה");
      setDetailsCoupon((coupon) =>
        coupon?.id === usageCoupon.id ? { ...coupon, used_value: usageCoupon.value || 0, status: "נוצל" } : coupon
      );
      setCodeCoupon((coupon) =>
        coupon?.id === usageCoupon.id ? { ...coupon, used_value: usageCoupon.value || 0, status: "נוצל" } : coupon
      );
      setUsageCoupon(null);
      setCompanyUsageAmount("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={openModal === "company"} onOpenChange={(open) => (open ? onOpenChange("company") : closeModal())}>
        <DialogContent className="legacy-modal-content company-modal-react" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedCompany ? `קופונים מחברת ${selectedCompany}` : "קופונים מחברה"}</DialogTitle>
          </DialogHeader>

          {selectedCompany && (
            <div className="legacy-company-modal-head">
              <img src={getCompanyLogo(selectedCompany)} alt={selectedCompany} />
              <strong>סה"כ נותר: {formatIls(selectedCompanyRemaining)}</strong>
            </div>
          )}

          <ul className="legacy-company-coupon-list">
            {selectedCompanyCoupons.map((coupon) => {
              const remaining = Math.max(0, coupon.value - coupon.used_value);
              return (
                <li key={coupon.id}>
                  <button type="button" className="legacy-company-coupon-link" onClick={() => setDetailsCoupon(coupon)}>
                    קוד: {coupon.code} - {coupon.is_one_time ? `מטרה: ${coupon.purpose || "-"}` : `נותר: ${formatIls(remaining)}`}
                  </button>
                  <div className="coupon-info-buttons">
                    {!coupon.is_one_time && (
                      <button
                        type="button"
                        className="update-usage-btn"
                        onClick={() => {
                          setUsageCoupon(coupon);
                          setCompanyUsageAmount("");
                          setCompanyUsageError("");
                        }}
                      >
                        <Pencil size={15} />
                        עדכון שימוש
                      </button>
                    )}
                    <button type="button" className="show-big-btn" onClick={() => setCodeCoupon(coupon)}>
                      <Eye size={15} />
                      הצגת קוד הקופון
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsCoupon} onOpenChange={(open) => !open && setDetailsCoupon(null)}>
        <DialogContent className="legacy-modal-content coupon-detail-modal-react" dir="rtl">
          {detailsCoupon && (
            <>
              <DialogHeader>
                <DialogTitle>פרטי קופון</DialogTitle>
              </DialogHeader>
              <div className="coupon-detail-react-card">
                <div className="coupon-detail-react-head">
                  <img src={getCompanyLogo(detailsCoupon.company)} alt={detailsCoupon.company} />
                  <h3>{detailsCoupon.company}</h3>
                </div>
                <div className="coupon-detail-grid">
                  <div><span>קוד מוצר:</span><strong>{detailsCoupon.code}</strong></div>
                  <div><span>חברה:</span><strong>{detailsCoupon.company}</strong></div>
                  <div><span>יתרה:</span><strong>{formatIls(Math.max(0, detailsCoupon.value - detailsCoupon.used_value))}</strong></div>
                  <div><span>שווי:</span><strong>{formatIls(detailsCoupon.value || 0)}</strong></div>
                  <div><span>נוצל:</span><strong>{formatIls(detailsCoupon.used_value || 0)}</strong></div>
                  <div><span>עלות:</span><strong>{formatIls(detailsCoupon.cost || 0)}</strong></div>
                  <div><span>תוקף:</span><strong>{formatDate(detailsCoupon.expiration)}</strong></div>
                  <div><span>סטטוס:</span><strong>{detailsCoupon.status}</strong></div>
                  {detailsCoupon.card_exp && <div><span>תוקף כרטיס:</span><strong>{detailsCoupon.card_exp}</strong></div>}
                  {detailsCoupon.cvv && <div><span>CVV:</span><strong>{detailsCoupon.cvv}</strong></div>}
                  {detailsCoupon.is_one_time && <div><span>קוד חד פעמי:</span><strong>כן</strong></div>}
                  {detailsCoupon.purpose && <div><span>מטרה:</span><strong>{detailsCoupon.purpose}</strong></div>}
                </div>
                {detailsCoupon.description && (
                  <div className="coupon-detail-description">
                    <span>תיאור:</span>
                    <p>{detailsCoupon.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!codeCoupon} onOpenChange={(open) => !open && setCodeCoupon(null)}>
        <DialogContent className="legacy-modal-content big-code-modal-react" dir="rtl">
          {codeCoupon && (
            <div className="big-code-content">
              <h2>{codeCoupon.company}</h2>
              <img src={getCompanyLogo(codeCoupon.company)} alt={codeCoupon.company} />
              <h1 data-testid="big-modal-coupon-code">{codeCoupon.code}</h1>
              {(codeCoupon.cvv || codeCoupon.card_exp) && (
                <div className="big-code-extra">
                  {codeCoupon.cvv && <h2>{codeCoupon.cvv} :CVV</h2>}
                  {codeCoupon.card_exp && <h2>תוקף: {codeCoupon.card_exp}</h2>}
                </div>
              )}
              <div className="big-code-qr" aria-label="QR code">
                <QRCodeSVG value={codeCoupon.code || " "} size={200} level="H" includeMargin />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageCoupon} onOpenChange={(open) => !open && setUsageCoupon(null)}>
        <DialogContent className="legacy-modal-content company-usage-modal-react" dir="rtl">
          {usageCoupon && (
            <div className="company-usage-content">
              <h3>עדכון סכום שימוש</h3>
              <h2>חברה: {usageCoupon.company}</h2>
              <img src={getCompanyLogo(usageCoupon.company)} alt={usageCoupon.company} />
              <p><strong>קוד קופון: {usageCoupon.code}</strong></p>
              <p><strong>יתרה נוכחית: {formatIls(Math.max(0, usageCoupon.value - usageCoupon.used_value))}</strong></p>
              <Input
                type="number"
                step="0.01"
                placeholder="בכמה השתמשת?"
                aria-label="בכמה השתמשת?"
                value={companyUsageAmount}
                onChange={(event) => setCompanyUsageAmount(event.target.value)}
              />
              {companyUsageError && <p className="legacy-field-error">{companyUsageError}</p>}
              <div className="legacy-modal-actions">
                <Button type="button" onClick={submitCompanyUsage} disabled={isSubmitting}>אישור</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={submitCompanyFullUsage}
                  disabled={isSubmitting}
                >
                  עדכון כל היתרה
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "stats"} onOpenChange={(open) => (open ? onOpenChange("stats") : closeModal())}>
        <DialogContent className="legacy-modal-content stats-modal-react" dir="rtl">
          <DialogHeader>
            <DialogTitle>סטטיסטיקות החיסכון שלך</DialogTitle>
            <DialogDescription>אותם מדדי חיסכון מהעמוד הישן, מחושבים מנתוני הקופונים הנוכחיים.</DialogDescription>
          </DialogHeader>

          <div className="legacy-stats-summary">
            <article>
              <h3>סך החיסכון שלך</h3>
              <strong>{formatIls(stats.totalSavings)}</strong>
              <span>מתוך {formatIls(stats.totalValue)} אפשריים</span>
            </article>
            <article>
              <h3>אחוז החיסכון</h3>
              <strong>{Math.round(stats.percentageSavings)}%</strong>
              <span>מכלל הקופונים</span>
            </article>
            <article>
              <h3>מספר קופונים</h3>
              <strong>{stats.totalCoupons}</strong>
              <span>{stats.activeCount} מתוכם פעילים</span>
            </article>
            <article>
              <h3>אחוז ניצול ממוצע</h3>
              <strong>{Math.round(stats.usageAverage)}%</strong>
              <span>ממוצע ניצול לכל הקופונים</span>
            </article>
          </div>

          <div className="legacy-stats-charts">
            <section>
              <h3><PieChartIcon size={18} /> התפלגות החיסכון לפי חברות</h3>
              <div className="legacy-chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={stats.companies.slice(0, 8)} dataKey="savings" nameKey="company" cx="50%" cy="50%" outerRadius={92} label>
                      {stats.companies.slice(0, 8).map((_, index) => (
                        <Cell key={index} fill={["#3498db", "#27ae60", "#f5b041", "#e74c3c", "#8e44ad", "#16a085", "#2c3e50", "#95a5a6"][index % 8]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatIls(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <h3><BarChart3 size={18} /> קופונים פעילים ומנוצלים לפי חברה</h3>
              <div className="legacy-chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.companies.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="company" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="active" name="פעילים" fill="#27ae60" />
                    <Bar dataKey="used" name="מנוצלים" fill="#2c3e50" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="legacy-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>חברה</th>
                  <th>סך חיסכון</th>
                  <th>אחוז חיסכון</th>
                  <th>סה"כ קופונים</th>
                  <th>קופונים פעילים</th>
                </tr>
              </thead>
              <tbody>
                {stats.companies.map((company) => (
                  <tr key={company.company}>
                    <td>{company.company}</td>
                    <td>{formatIls(company.savings)}</td>
                    <td>{company.value > 0 ? Math.round((company.savings / company.value) * 100) : 0}%</td>
                    <td>{company.count}</td>
                    <td>{company.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "usage"} onOpenChange={(open) => (open ? onOpenChange("usage") : closeModal())}>
        <DialogContent className={`legacy-modal-content usage-modal-react ${usageRows ? "review-mode" : ""}`} dir="rtl">
          {!usageRows ? (
            <>
              <DialogHeader>
                <DialogTitle>דיווח אוטומטי על שימוש בקופונים</DialogTitle>
              </DialogHeader>

              <div className="legacy-usage-input-mode">
                <div className="input-wrapper">
                  <Label htmlFor="usage_explanation">תיאור השימוש</Label>
                  <Textarea
                    id="usage_explanation"
                    rows={4}
                    className="input-field"
                    placeholder="תפרט כאן באלו קופונים השתמשת ובכמה"
                    value={usageText}
                    onChange={(event) => setUsageText(event.target.value)}
                  />
                </div>

                <div className="slots-info">
                  <div className="slots-info-content">
                    יש לך עוד סלוטים זמינים למילוי אוטומטית.
                  </div>
                </div>

                {usageReportError && <p className="legacy-field-error">{usageReportError}</p>}

                <div className="actions-container">
                  <button type="button" className="btn-secondary cancel-button" onClick={closeModal}>ביטול</button>
                  <button type="button" className="btn-primary submit-button" onClick={parseUsageText}>שלח דיווח</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>אישור שימושים שאותרו</DialogTitle>
              </DialogHeader>

              <div className="table-wrapper">
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>סימון</th>
                      <th>חברה שזוהתה</th>
                      <th>קופון</th>
                      <th>כמה השתמשת</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row) => {
                      const selected = activeCoupons.find((coupon) => String(coupon.id) === row.couponId);
                      const remaining = selected ? Math.max(0, selected.value - selected.used_value) : 0;
                      return (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              className="usage-checkbox"
                              checked={row.checked}
                              onChange={(event) => updateUsageRow(row.id, { checked: event.target.checked })}
                              aria-label="סימון"
                            />
                          </td>
                          <td>{row.detectedCompany}</td>
                          <td>
                            <select
                              className="coupon-select"
                              value={row.couponId}
                              onChange={(event) => updateUsageRow(row.id, { couponId: event.target.value })}
                              aria-label="קופון"
                            >
                              {activeCoupons.map((coupon) => (
                                <option value={String(coupon.id)} key={coupon.id}>
                                  {coupon.company} ({coupon.code}) - נותר: {formatIls(Math.max(0, coupon.value - coupon.used_value))}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="amount-wrapper">
                              <input
                                type="text"
                                className="amount-input"
                                value={row.amount}
                                onChange={(event) => updateUsageRow(row.id, { amount: event.target.value })}
                                aria-label="כמה השתמשת"
                              />
                              <button type="button" className="btn-used" onClick={() => updateUsageRow(row.id, { amount: remaining.toFixed(2) })}>
                                ניצול מלא
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {usageReportError && <p className="legacy-field-error">{usageReportError}</p>}

              <div className="actions-container">
                <button type="button" id="backToInput" className="btn-secondary" onClick={() => setUsageRows(null)}>חזרה</button>
                <button type="button" className="btn-primary" onClick={submitParsedUsages} disabled={isSubmitting}>
                  {isSubmitting ? "מעבד..." : "אישור"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === "quick-add"} onOpenChange={(open) => (open ? onOpenChange("quick-add") : closeModal())}>
        <DialogContent className="legacy-modal-content quick-add-modal-react" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת קופון מהירה</DialogTitle>
            <DialogDescription>טופס רב-שלבי לפי הזרימה של האתר הישן.</DialogDescription>
          </DialogHeader>

          <form onSubmit={quickForm.handleSubmit(submitQuickAdd)}>
            <div className="quick-step-indicator">
              <span>{quickStep}</span> / <span>5</span>
              <div><i style={{ width: `${(quickStep / 5) * 100}%` }} /></div>
            </div>

            {quickStep === 1 && (
              <div className="quick-step-card">
                <h4>באיזו חברה מדובר?</h4>
                <div className="form-group">
                  <Label>חברה</Label>
                  <Select value={quickForm.watch("company")} onValueChange={(value) => quickForm.setValue("company", value, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="בחר חברה" /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {companyOptions.map((company) => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <Label htmlFor="quick_company">או הזן חברה חדשה</Label>
                  <Input id="quick_company" {...quickForm.register("company")} />
                </div>
                <div className="legacy-auto-detect-box">
                  <h4>זיהוי אוטומטי של קופון</h4>
                  <Textarea placeholder="הדבק כאן את פרטי הקופון" rows={3} onBlur={(event) => {
                    const text = event.target.value;
                    const amount = text.match(/(?:₪|שח|ש\"ח)?\\s?(\\d+(?:\\.\\d+)?)/);
                    if (amount && !quickForm.getValues("value")) quickForm.setValue("value", Number(amount[1]));
                  }} />
                </div>
              </div>
            )}

            {quickStep === 2 && (
              <div className="quick-step-card">
                <h4>פרטי הקופון</h4>
                <div className="form-group"><Label>קוד קופון</Label><Input {...quickForm.register("code")} /></div>
                <div className="form-group"><Label>כמה שילמת על הקופון</Label><Input type="number" step="0.01" {...quickForm.register("cost")} /></div>
                <div className="form-group"><Label>כמה הקופון שווה בפועל</Label><Input type="number" step="0.01" {...quickForm.register("value")} /></div>
                <div className="discount-display">אחוז הנחה: {Math.round(discount)}%</div>
              </div>
            )}

            {quickStep === 3 && (
              <div className="quick-step-card">
                <h4>תוקף ותיאור</h4>
                <div className="form-group"><Label>תאריך תפוגה</Label><Input type="date" {...quickForm.register("expiration")} /></div>
                <div className="form-group"><Label>תיאור הקופון</Label><Textarea rows={3} {...quickForm.register("description")} /></div>
              </div>
            )}

            {quickStep === 4 && (
              <div className="quick-step-card">
                <h4>פרטים נוספים</h4>
                <div className="form-group"><Label>מאיפה קיבלת את הקופון</Label><Input {...quickForm.register("source")} /></div>
                <label className="legacy-checkbox-row">
                  <Checkbox checked={quickForm.watch("include_card_info")} onCheckedChange={(checked) => quickForm.setValue("include_card_info", Boolean(checked))} />
                  האם להכניס תוקף כרטיס ו-CVV?
                </label>
                {quickForm.watch("include_card_info") && (
                  <div className="legacy-two-cols">
                    <div className="form-group"><Label>CVV</Label><Input maxLength={4} {...quickForm.register("cvv")} /></div>
                    <div className="form-group"><Label>תוקף כרטיס</Label><Input placeholder="MM/YY" maxLength={5} {...quickForm.register("card_exp")} /></div>
                  </div>
                )}
                <label className="legacy-checkbox-row">
                  <Checkbox checked={quickForm.watch("is_one_time")} onCheckedChange={(checked) => quickForm.setValue("is_one_time", Boolean(checked))} />
                  קוד לשימוש חד פעמי
                </label>
                {quickForm.watch("is_one_time") && <div className="form-group"><Label>מטרת הקופון</Label><Input {...quickForm.register("purpose")} /></div>}
              </div>
            )}

            {quickStep === 5 && (
              <div className="quick-step-card">
                <h4>סיכום הקופון</h4>
                <div className="legacy-summary-list">
                  <p><strong>חברה:</strong> {watchedQuick.company || "-"}</p>
                  <p><strong>קוד:</strong> {watchedQuick.code || "-"}</p>
                  <p><strong>עלות:</strong> {formatIls(Number(watchedQuick.cost || 0))}</p>
                  <p><strong>שווי:</strong> {formatIls(Number(watchedQuick.value || 0))}</p>
                  <p><strong>הנחה:</strong> {Math.round(discount)}%</p>
                  {watchedQuick.expiration && <p><strong>תפוגה:</strong> {watchedQuick.expiration}</p>}
                </div>
              </div>
            )}

            {(quickForm.formState.errors.company || quickForm.formState.errors.code || quickForm.formState.errors.value || quickForm.formState.errors.cost) && (
              <p className="legacy-field-error">יש למלא את שדות החובה לפני שמירה.</p>
            )}

            <div className="legacy-modal-actions">
              <Button type="button" variant="outline" onClick={() => setQuickStep((step) => Math.max(1, step - 1))} disabled={quickStep === 1 || isSubmitting}>
                הקודם
              </Button>
              {quickStep < 5 ? (
                <Button type="button" onClick={() => setQuickStep((step) => Math.min(5, step + 1))}>הבא</Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  <CheckCircle2 className="h-4 w-4" />
                  הוספת קופון
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={closeModal}>ביטול</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { DashboardModalType };
