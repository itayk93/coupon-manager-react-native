import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BarChart3, CheckCircle2, ChevronDown, Eye, MessageCircle, Pencil, PieChart as PieChartIcon, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecryptedCoupon, useAddCoupon, useUpdateCoupon } from "@/hooks/useCoupons";
import { useParseCoupon } from "@/hooks/useCouponAI";
import type { ParsedCoupon } from "@/hooks/useCouponAI";
import { useCompanies } from "@/hooks/useAdminManagement";
import { getCompanyLogo, hasStaticLogo, resolveCompanyLogo } from "@/lib/companyLogos";
import { matchCompanyName } from "@/lib/companyMatch";
import { CompanyPicker, type PickerCompany } from "@/components/dashboard/CompanyPicker";
import { CouponDetailModal } from "@/components/coupons/CouponDetailModal";
import { useCouponViewTracking } from "@/hooks/useCouponViewTracking";
import { useAuth } from "@/contexts/AuthContext";


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
  auto_download_details: z.string().optional().nullable(),
  auto_update: z.boolean().default(true),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

type ParsedUsageRow = {
  id: string;
  checked: boolean;
  detectedCompany: string;
  couponId: string;
  amount: string;
};

function normalizeAutoProvider(value: string | null | undefined, allowAutoUpdater: boolean) {
  if (!allowAutoUpdater) return null;
  return value === "BuyMe" || value === "Multipass" || value === "Max" ? value : null;
}

function getDefaultAutoProvider(company: string | null | undefined) {
  const compName = company?.trim().toLowerCase() || "";
  if (compName.includes("buyme") || compName.includes("ביימי")) return "BuyMe";
  if (compName.includes("multipass") || compName.includes("מולטיפאס")) return "Multipass";
  if (compName.includes("max") || compName.includes("מקס")) return "Max";
  if (compName.includes("xtra") || compName.includes("אקסטרה")) return "Multipass";
  return null;
}

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

function formatDate(value: string | null) {
  if (!value) return "ללא תוקף";
  return new Date(value).toLocaleDateString("he-IL");
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover border border-border text-popover-foreground shadow-2xl rounded-xl p-3 text-xs text-right" dir="rtl">
        <div className="font-semibold text-sm mb-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color || data.fill }} />
          {data.name}
        </div>
        <div className="text-muted-foreground">
          חיסכון מצטבר: <span className="font-bold text-foreground">{formatIls(data.value)}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 border border-border/60 text-popover-foreground shadow-xl rounded-xl p-3 text-xs backdrop-blur-md text-right" dir="rtl">
        <div className="font-semibold text-sm mb-2 border-b border-border/40 pb-1">{label}</div>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: item.color || item.fill }} />
              {item.name}:
            </span>
            <span className="font-bold text-foreground">{item.value} קופונים</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function DashboardModals({ openModal, onOpenChange, coupons, selectedCompany }: DashboardModalsProps) {
  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const parseCoupon = useParseCoupon();
  const { markDetailViewed, markCodeViewed, markCompanyViewed } = useCouponViewTracking();
  const { data: dbCompanies } = useCompanies();
  const { user } = useAuth();
  const [quickText, setQuickText] = useState("");
  const [quickDetected, setQuickDetected] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [otherCompanyMode, setOtherCompanyMode] = useState(false);
  const [remainingQuickCoupons, setRemainingQuickCoupons] = useState<ParsedCoupon[]>([]);
  const [quickCouponCount, setQuickCouponCount] = useState(0);
  const [currentQuickCoupon, setCurrentQuickCoupon] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailsCoupon, setDetailsCoupon] = useState<DecryptedCoupon | null>(null);
  const [codeCoupon, setCodeCoupon] = useState<DecryptedCoupon | null>(null);
  const [usageCoupon, setUsageCoupon] = useState<DecryptedCoupon | null>(null);
  const [companyUsageAmount, setCompanyUsageAmount] = useState("");
  const [companyUsageError, setCompanyUsageError] = useState("");
  const [usageText, setUsageText] = useState("");
  const [usageRows, setUsageRows] = useState<ParsedUsageRow[] | null>(null);
  const [usageReportError, setUsageReportError] = useState("");
  const [markUsedCoupon, setMarkUsedCoupon] = useState<DecryptedCoupon | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  useEffect(() => {
    if (detailsCoupon) void markDetailViewed(detailsCoupon.id);
  }, [detailsCoupon, markDetailViewed]);

  useEffect(() => {
    if (codeCoupon) void markCodeViewed(codeCoupon.id);
  }, [codeCoupon, markCodeViewed]);

  useEffect(() => {
    if (openModal === "company" && selectedCompany) void markCompanyViewed(selectedCompany);
  }, [markCompanyViewed, openModal, selectedCompany]);

  const activeCoupons = useMemo(
    () => coupons.filter((coupon) => !coupon.is_for_sale && coupon.status !== "נוצל"),
    [coupons]
  );

  // Company list for the picker + AI matching: the admin-managed `companies` table
  // (with official logos) merged with the distinct companies from the user's own
  // coupons, so the list is never empty and always covers what the user actually uses.
  const pickerCompanies = useMemo<PickerCompany[]>(() => {
    const byName = new Map<string, PickerCompany>();
    (dbCompanies || []).forEach((company) => {
      const name = company.name?.trim();
      if (name) {
        const logo = resolveCompanyLogo(name, company.image_path);
        byName.set(name, { name, logo });
      }
    });
    coupons.forEach((coupon) => {
      const name = coupon.company?.trim();
      if (name && !byName.has(name)) byName.set(name, { name, logo: resolveCompanyLogo(name) });
    });
    return Array.from(byName.values());
  }, [dbCompanies, coupons]);

  const companyNames = useMemo(() => pickerCompanies.map((company) => company.name), [pickerCompanies]);

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
      auto_download_details: null,
      auto_update: true,
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

  const topCompaniesForPie = useMemo(() => {
    if (!stats.companies || stats.companies.length === 0) return [];
    if (stats.companies.length <= 5) return stats.companies;
    const top5 = stats.companies.slice(0, 5);
    const othersSavings = stats.companies.slice(5).reduce((sum, c) => sum + c.savings, 0);
    if (othersSavings > 0) {
      return [
        ...top5,
        { company: "אחרים", savings: othersSavings, value: 0, remaining: 0, count: 0, active: 0, used: 0 },
      ];
    }
    return top5;
  }, [stats.companies]);

  const topCompaniesForBar = useMemo(() => {
    if (!stats.companies || stats.companies.length === 0) return [];
    return stats.companies.slice(0, 6);
  }, [stats.companies]);

  const selectedCompanyCoupons = activeCoupons.filter((coupon) => coupon.company === selectedCompany);
  const selectedCompanyRemaining = selectedCompanyCoupons.reduce((sum, coupon) => sum + Math.max(0, coupon.value - coupon.used_value), 0);
  const watchedQuick = quickForm.watch();
  const discount = watchedQuick.value > 0 ? Math.max(0, ((watchedQuick.value - watchedQuick.cost) / watchedQuick.value) * 100) : 0;
  const showAutoUsageUpdater = user?.id === 1;

  const closeModal = () => {
    onOpenChange(null);
    setQuickText("");
    setQuickDetected(false);
    setRemainingQuickCoupons([]);
    setQuickCouponCount(0);
    setCurrentQuickCoupon(0);
    setCompanyPickerOpen(false);
    setOtherCompanyMode(false);
    setUsageRows(null);
    setUsageReportError("");
  };

  const fillQuickForm = (coupon: ParsedCoupon) => {
    const detectedCompany = coupon.company?.trim() || "";
    const matchedCompany = detectedCompany ? matchCompanyName(detectedCompany, companyNames) : null;
    setOtherCompanyMode(Boolean(detectedCompany) && !matchedCompany);

    const defaultAutoProvider = getDefaultAutoProvider(matchedCompany || detectedCompany);

    quickForm.reset({
      company: matchedCompany || detectedCompany,
      code: coupon.code || "",
      cost: coupon.cost ?? 0,
      value: coupon.value ?? 0,
      discount_percentage: 0,
      expiration: coupon.expiration || "",
      description: coupon.description || "",
      source: "",
      include_card_info: Boolean(coupon.cvv || coupon.card_exp),
      cvv: coupon.cvv || "",
      card_exp: coupon.card_exp || "",
      is_one_time: false,
      purpose: "",
      auto_download_details: normalizeAutoProvider(defaultAutoProvider, showAutoUsageUpdater),
      auto_update: Boolean(normalizeAutoProvider(defaultAutoProvider, showAutoUsageUpdater)),
    });
  };

  const handleDetectCoupon = async () => {
    const text = quickText.trim();
    if (!text) return;
    try {
      const rawCoupons = await parseCoupon.mutateAsync({ text, companyNames });
      const seenCodes = new Set<string>();
      const parsedCoupons = rawCoupons.filter((c) => {
        const codeKey = c.code ? c.code.trim().toLowerCase() : null;
        if (!codeKey) return true;
        if (seenCodes.has(codeKey)) return false;
        seenCodes.add(codeKey);
        return true;
      });

      const [firstCoupon, ...otherCoupons] = parsedCoupons;
      if (!firstCoupon) return;

      fillQuickForm(firstCoupon);
      setRemainingQuickCoupons(otherCoupons);
      setQuickCouponCount(parsedCoupons.length);
      setCurrentQuickCoupon(1);
      setQuickDetected(true);
    } catch {
    }
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
        expiration: data.expiration ? new Date(data.expiration).toISOString().split('T')[0] : null,
        cvv: data.include_card_info ? data.cvv || null : null,
        card_exp: data.include_card_info ? data.card_exp || null : null,
        is_one_time: data.is_one_time,
        purpose: data.is_one_time ? data.purpose || null : null,
        auto_download_details: normalizeAutoProvider(data.auto_download_details, showAutoUsageUpdater),
        auto_update: Boolean(normalizeAutoProvider(data.auto_download_details, showAutoUsageUpdater)),
        status: "פעיל",
        date_added: new Date().toISOString(),
      });

      const [nextCoupon, ...couponsAfterNext] = remainingQuickCoupons;
      if (nextCoupon) {
        fillQuickForm(nextCoupon);
        setRemainingQuickCoupons(couponsAfterNext);
        setCurrentQuickCoupon((current) => current + 1);
        return;
      }

      quickForm.reset({
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
        auto_download_details: null,
        auto_update: false,
      });
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
      const updatedStatus = usageCoupon.value > 0 && nextUsedValue >= usageCoupon.value ? "נוצל" : usageCoupon.status;
      const patchLocal = (prev: DecryptedCoupon | null) =>
        prev?.id === usageCoupon.id ? { ...prev, used_value: nextUsedValue, status: updatedStatus } : prev;
      setDetailsCoupon(patchLocal);
      setCodeCoupon(patchLocal);
      setCompanyUsageAmount("");
      setCompanyUsageError("");
      // Close the usage dialog after a short delay so the drawer underneath re-layouts cleanly
      requestAnimationFrame(() => setUsageCoupon(null));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitMarkUsed = async () => {
    if (!markUsedCoupon) return;
    setIsSubmitting(true);
    try {
      await updateCoupon.mutateAsync({
        id: markUsedCoupon.id,
        updates: {
          used_value: markUsedCoupon.value || 0,
          status: "נוצל",
        },
      });
      const patchUsed = (prev: DecryptedCoupon | null) =>
        prev?.id === markUsedCoupon.id ? { ...prev, used_value: markUsedCoupon.value || 0, status: "נוצל" as const } : prev;
      setDetailsCoupon(patchUsed);
      setCodeCoupon(patchUsed);
      setMarkUsedCoupon(null);
      const remainingActive = selectedCompanyCoupons.filter(c => c.id !== markUsedCoupon.id).length;
      if (remainingActive === 0) closeModal();
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
      const patchFull = (prev: DecryptedCoupon | null) =>
        prev?.id === usageCoupon.id ? { ...prev, used_value: usageCoupon.value || 0, status: "נוצל" as const } : prev;
      setDetailsCoupon(patchFull);
      setCodeCoupon(patchFull);
      setCompanyUsageAmount("");
      setCompanyUsageError("");
      const remainingActive = selectedCompanyCoupons.filter(c => c.id !== usageCoupon.id).length;
      if (remainingActive === 0) {
        requestAnimationFrame(() => { setUsageCoupon(null); closeModal(); });
      } else {
        requestAnimationFrame(() => setUsageCoupon(null));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Drawer open={openModal === "company"} onOpenChange={(open) => (open ? onOpenChange("company") : closeModal())}>
        <DrawerContent dir="rtl" className="mx-auto w-full max-w-[560px] bg-background p-0 text-right lg:max-w-[720px]">
          <div className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden">
            <div className="shrink-0 rounded-t-[30px] bg-gradient-to-b from-primary/85 via-primary/90 to-primary px-5 pb-4 pt-3 text-primary-foreground lg:px-6 lg:pb-3">
              <DrawerHeader className="px-0 pb-0 pt-2 text-right">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <DrawerTitle className="text-right text-[23px] font-black leading-tight text-primary-foreground lg:text-[24px]">
                      {selectedCompany ? `קופונים מחברת ${selectedCompany}` : "קופונים מחברה"}
                    </DrawerTitle>
                    <DrawerDescription className="mt-2 text-right text-sm text-primary-foreground/80 lg:mt-1 lg:text-xs">
                      {selectedCompanyCoupons.length} קופונים זמינים לצפייה ולעדכון
                    </DrawerDescription>
                    <div className="mt-3 text-right lg:mt-3">
                      <div className="text-sm text-primary-foreground/75 lg:text-xs">סה״כ נותר</div>
                      <div className="text-[32px] font-black tracking-tight lg:text-[28px]">{formatIls(selectedCompanyRemaining)}</div>
                    </div>
                  </div>

                  {selectedCompany && (
                    <div className="shrink-0 rounded-[18px] bg-white/95 p-1.5 shadow-sm ring-1 ring-white/60">
                      <img
                        src={getCompanyLogo(selectedCompany)}
                        alt={selectedCompany}
                        className="h-14 w-14 rounded-[14px] object-contain lg:h-14 lg:w-14 lg:rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </DrawerHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 pb-6 pt-4 lg:px-5 lg:pt-3">
              <ul className="space-y-3">
                {selectedCompanyCoupons.map((coupon) => {
                  const remaining = Math.max(0, coupon.value - coupon.used_value);
                  return (
                    <li
                      key={coupon.id}
                      className="rounded-[22px] border border-border/60 bg-background p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                    >
                      <button
                        type="button"
                        className="w-full text-right"
                        onClick={() => setDetailsCoupon(coupon)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-muted-foreground">קוד קופון</div>
                            <div className="mt-1 break-all text-[19px] font-black leading-tight text-foreground">{coupon.code}</div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {coupon.is_one_time ? `מטרה: ${coupon.purpose || "-"}` : `נותר: ${formatIls(remaining)}`}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-2xl bg-muted/60 p-2">
                            <img
                              src={getCompanyLogo(coupon.company)}
                              alt={coupon.company}
                              className="h-12 w-12 rounded-xl object-contain"
                            />
                          </div>
                        </div>
                      </button>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {!coupon.is_one_time && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 justify-between rounded-2xl border-border bg-background px-4 text-sm font-extrabold text-foreground hover:bg-muted/40"
                            onClick={() => {
                              setUsageCoupon(coupon);
                              setCompanyUsageAmount("");
                              setCompanyUsageError("");
                            }}
                          >
                            עדכון סכום שימוש
                            <Pencil size={20} />
                          </Button>
                        )}
                        {coupon.is_one_time && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-16 justify-between rounded-2xl border-emerald-200 bg-emerald-50 px-5 text-base font-extrabold text-emerald-700 hover:bg-emerald-100"
                            onClick={() => setMarkUsedCoupon(coupon)}
                          >
                            סימון כנוצל
                            <CheckCircle2 size={20} />
                          </Button>
                        )}

                        <Button
                          type="button"
                          className="h-12 justify-between rounded-2xl px-4 text-sm font-extrabold"
                          onClick={() => setCodeCoupon(coupon)}
                        >
                          הצגת קוד הקופון
                          <Eye size={20} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <CouponDetailModal
        coupon={detailsCoupon}
        onClose={() => setDetailsCoupon(null)}
        onOpenUsage={(coupon) => {
          setUsageCoupon(coupon);
          setCompanyUsageAmount("");
          setCompanyUsageError("");
        }}
        onMarkUsed={(coupon) => setMarkUsedCoupon(coupon)}
      />


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
                <QRCodeSVG value={codeCoupon.code || " "} size={180} level="H" includeMargin />
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

      <Dialog open={!!markUsedCoupon} onOpenChange={(open) => !open && setMarkUsedCoupon(null)}>
        <DialogContent className="legacy-modal-content company-usage-modal-react" dir="rtl">
          {markUsedCoupon && (
            <div className="company-usage-content">
              <h3>סימון קופון כנוצל</h3>
              <h2>חברה: {markUsedCoupon.company}</h2>
              <img src={getCompanyLogo(markUsedCoupon.company)} alt={markUsedCoupon.company} />
              <p><strong>קוד קופון: {markUsedCoupon.code}</strong></p>
              {markUsedCoupon.purpose && <p>מטרה: {markUsedCoupon.purpose}</p>}
              <p className="text-sm text-muted-foreground mt-2">
                האם אתה בטוח שברצונך לסמן את הקופון כנוצל? פעולה זו תסמן שהשתמשת בכל הקופון.
              </p>
              <div className="legacy-modal-actions">
                <Button type="button" onClick={submitMarkUsed} disabled={isSubmitting}>
                  {isSubmitting ? "מעדכן..." : "אישור - סמן כנוצל"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMarkUsedCoupon(null)} disabled={isSubmitting}>
                  ביטול
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
              <h3><PieChartIcon size={18} className="text-primary" /> התפלגות החיסכון לפי חברות</h3>
              <div className="legacy-chart-box" dir="ltr">
                <div className="donut-center-overlay">
                  {activePieIndex !== null && topCompaniesForPie[activePieIndex] ? (
                    <>
                      <span className="donut-center-label" style={{ color: CHART_COLORS[activePieIndex % CHART_COLORS.length] }}>
                        {topCompaniesForPie[activePieIndex].company}
                      </span>
                      <span className="donut-center-val">{formatIls(topCompaniesForPie[activePieIndex].savings)}</span>
                    </>
                  ) : (
                    <>
                      <span className="donut-center-label">סה"כ חיסכון</span>
                      <span className="donut-center-val">{formatIls(stats.totalSavings)}</span>
                    </>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Pie
                      data={topCompaniesForPie}
                      dataKey="savings"
                      nameKey="company"
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="none"
                      onMouseEnter={(_, index) => setActivePieIndex(index)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      {topCompaniesForPie.map((_, index) => (
                        <Cell
                          key={index}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          opacity={activePieIndex === null || activePieIndex === index ? 1 : 0.45}
                          style={{ transition: "opacity 0.2s ease" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 100 }} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span style={{ color: "var(--foreground, #1e293b)", fontSize: "12px", direction: "rtl" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <h3><BarChart3 size={18} className="text-primary" /> קופונים פעילים ומנוצלים לפי חברה</h3>
              <div className="legacy-chart-box" dir="ltr">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    layout="vertical"
                    data={topCompaniesForBar}
                    margin={{ top: 10, right: 20, left: 5, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis dataKey="company" type="category" width={85} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 500 }} />
                    <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} content={<CustomBarTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span style={{ color: "var(--foreground, #1e293b)", fontSize: "12px" }}>{value}</span>}
                    />
                    <Bar dataKey="active" name="פעילים" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="used" name="מנוצלים" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="legacy-table-wrapper">
            <table className="legacy-stats-table">
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
                    <td className="font-medium">{company.company}</td>
                    <td className="font-semibold text-primary">{formatIls(company.savings)}</td>
                    <td>{company.value > 0 ? Math.round((company.savings / company.value) * 100) : 0}%</td>
                    <td>{company.count}</td>
                    <td>{company.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="legacy-stats-mobile-cards">
              {stats.companies.map((company) => {
                const savingsPct = company.value > 0 ? Math.round((company.savings / company.value) * 100) : 0;
                return (
                  <div key={company.company} className="legacy-mobile-card">
                    <div className="legacy-mobile-card-top">
                      <span className="company-name">{company.company}</span>
                      <span className="company-savings">{formatIls(company.savings)}</span>
                    </div>
                    <div className="legacy-mobile-card-bottom">
                      <span className="card-badge badge-pct">{savingsPct}% חיסכון</span>
                      <span className="card-badge badge-total">{company.count} קופונים</span>
                      <span className="card-badge badge-active">{company.active} פעילים</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
            <DialogDescription>הדבק את פרטי הקופון והמערכת תזהה אותם אוטומטית.</DialogDescription>
          </DialogHeader>

          <form onSubmit={quickForm.handleSubmit(submitQuickAdd)}>
            <div className="quick-step-card">
              <div className="legacy-auto-detect-box">
                <h4>זיהוי אוטומטי של קופון</h4>
                <Textarea
                  placeholder="הדבק כאן את פרטי הקופון"
                  rows={5}
                  value={quickText}
                  onChange={(event) => setQuickText(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleDetectCoupon}
                  disabled={parseCoupon.isPending || !quickText.trim()}
                >
                  {parseCoupon.isPending ? "מזהה..." : "זיהוי אוטומטי"}
                </Button>
              </div>

              {quickDetected && (
                <div className="legacy-summary-list">
                  {quickCouponCount > 1 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
                      קופון {currentQuickCoupon} מתוך {quickCouponCount}
                    </div>
                  )}
                  <div className="form-group">
                    <Label>חברה</Label>
                    <button
                      type="button"
                      className="company-select-trigger"
                      onClick={() => setCompanyPickerOpen(true)}
                    >
                      {watchedQuick.company && !otherCompanyMode ? (
                        <span className="company-select-value">
                          <img
                            src={pickerCompanies.find((company) => company.name === watchedQuick.company)?.logo || getCompanyLogo(watchedQuick.company)}
                            alt=""
                            className="company-select-logo"
                            onError={(event) => { (event.target as HTMLImageElement).src = "/legacy-images/default.png"; }}
                          />
                          <span>{watchedQuick.company}</span>
                        </span>
                      ) : otherCompanyMode ? (
                        <span className="company-select-value">חברה חדשה (אחר)</span>
                      ) : (
                        <span className="company-select-placeholder">בחר חברה מהרשימה</span>
                      )}
                      <ChevronDown className="company-select-chevron" aria-hidden />
                    </button>
                    {otherCompanyMode && (
                      <Input
                        className="company-other-input"
                        placeholder="הזן שם חברה חדשה"
                        {...quickForm.register("company")}
                      />
                    )}
                  </div>
                  <div className="form-group"><Label>קוד קופון</Label><Input {...quickForm.register("code")} /></div>
                  <div className="form-group"><Label>כמה שילמת על הקופון</Label><Input type="number" step="0.01" {...quickForm.register("cost")} /></div>
                  <div className="form-group"><Label>כמה הקופון שווה בפועל</Label><Input type="number" step="0.01" {...quickForm.register("value")} /></div>
                  <div className="form-group"><Label>תאריך תפוגה</Label><Input type="date" {...quickForm.register("expiration")} /></div>
                  <div className="form-group"><Label>תיאור / הערות</Label><Input placeholder="תיאור הקופון (אופציונלי)" {...quickForm.register("description")} /></div>
                  <div className="form-group"><Label>מקור הקופון</Label><Input placeholder="למשל: BuyMe, הייטקזון, אשראי" {...quickForm.register("source")} /></div>
                  <div className="discount-display">אחוז הנחה: {Math.round(discount)}%</div>

                  <div className="space-y-3 pt-2 border-t mt-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id="quick_include_card_info"
                        checked={watchedQuick.include_card_info}
                        onCheckedChange={(checked) => quickForm.setValue("include_card_info", Boolean(checked))}
                      />
                      <Label htmlFor="quick_include_card_info" className="cursor-pointer text-sm font-medium">כולל פרטי כרטיס נטען (CVV / תוקף כרטיס)</Label>
                    </div>

                    {watchedQuick.include_card_info && (
                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <div className="form-group">
                          <Label htmlFor="quick_cvv" className="text-xs">קוד CVV</Label>
                          <Input id="quick_cvv" placeholder="123" {...quickForm.register("cvv")} />
                        </div>
                        <div className="form-group">
                          <Label htmlFor="quick_card_exp" className="text-xs">תוקף כרטיס (MM/YY)</Label>
                          <Input id="quick_card_exp" placeholder="07/31" {...quickForm.register("card_exp")} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 space-x-reverse pt-1">
                      <Checkbox
                        id="quick_is_one_time"
                        checked={watchedQuick.is_one_time}
                        onCheckedChange={(checked) => quickForm.setValue("is_one_time", Boolean(checked))}
                      />
                      <Label htmlFor="quick_is_one_time" className="cursor-pointer text-sm font-medium">קופון חד-פעמי (מטרה מוגדרת)</Label>
                    </div>

                    {watchedQuick.is_one_time && (
                      <div className="pr-6 form-group">
                        <Label htmlFor="quick_purpose" className="text-xs">מטרת השימוש</Label>
                        <Input id="quick_purpose" placeholder="למשל: ארוחת ערב צוותית" {...quickForm.register("purpose")} />
                      </div>
                    )}

                    {showAutoUsageUpdater && (
                      <div className="form-group pt-2 border-t mt-2">
                        <Label htmlFor="quick_auto_download_details" className="text-sm font-medium">עדכון שימוש אוטומטי</Label>
                        <Select
                          value={watchedQuick.auto_download_details || "none"}
                          onValueChange={(val) => {
                            const selected = val === "none" ? null : val;
                            quickForm.setValue("auto_download_details", selected);
                            quickForm.setValue("auto_update", selected !== null);
                          }}
                        >
                          <SelectTrigger id="quick_auto_download_details" className="w-full mt-1">
                            <SelectValue placeholder="בחר ספק לעדכון שימוש אוטומטי" />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="none">ללא (ללא עדכון אוטומטי)</SelectItem>
                            <SelectItem value="BuyMe">BuyMe</SelectItem>
                            <SelectItem value="Multipass">Multipass</SelectItem>
                            <SelectItem value="Max">Max</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {quickDetected && (quickForm.formState.errors.company || quickForm.formState.errors.code || quickForm.formState.errors.value || quickForm.formState.errors.cost) && (
              <p className="legacy-field-error">יש למלא את שדות החובה לפני שמירה.</p>
            )}

            <div className="legacy-modal-actions">
              {quickDetected && (
                <Button type="submit" disabled={isSubmitting}>
                  <CheckCircle2 className="h-4 w-4" />
                  {remainingQuickCoupons.length > 0 ? "שמירה ומעבר לקופון הבא" : "הוספת קופון"}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={closeModal}>ביטול</Button>
            </div>
          </form>

          <CompanyPicker
            open={companyPickerOpen}
            onOpenChange={setCompanyPickerOpen}
            companies={pickerCompanies}
            value={otherCompanyMode ? "" : watchedQuick.company}
            onSelect={(name) => {
              setOtherCompanyMode(false);
              quickForm.setValue("company", name, { shouldValidate: true });
            }}
            onSelectOther={() => {
              setOtherCompanyMode(true);
              quickForm.setValue("company", "", { shouldValidate: true });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { DashboardModalType };
