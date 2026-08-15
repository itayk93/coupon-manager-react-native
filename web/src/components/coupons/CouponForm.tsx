import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAddCoupon, useUpdateCoupon, DecryptedCoupon } from '@/hooks/useCoupons';
import { useSetCouponTags, useCouponTags } from '@/hooks/useTags';
import { AiParsePanel } from '@/components/coupons/AiParsePanel';
import type { ParsedCoupon } from '@/hooks/useCouponAI';
import { useCompanies } from '@/hooks/useAdminManagement';
import { useAuth } from '@/contexts/AuthContext';
import { matchCompanyName } from '@/lib/companyMatch';
import { TagsInput } from '@/components/coupons/TagsInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const couponSchema = z.object({
  company: z.string().min(2, { message: "שם החברה חייב להכיל לפחות 2 תווים" }),
  code: z.string().min(1, { message: "קוד קופון הוא שדה חובה" }),
  value: z.coerce.number().min(0, { message: "שווי חייב להיות מספר חיובי" }),
  cost: z.coerce.number().min(0, { message: "עלות חייבת להיות מספר חיובי" }),
  used_value: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
  expiration: z.string().optional(),
  is_available: z.boolean().default(true),
  is_one_time: z.boolean().default(false),
  purpose: z.string().optional(),
  cvv: z.string().optional(),
  card_exp: z.string().optional(),
  auto_download_details: z.string().optional().nullable(),
  auto_update: z.boolean().default(true),
});

type CouponFormValues = z.infer<typeof couponSchema>;

interface CouponFormProps {
  coupon?: DecryptedCoupon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function CouponForm({ coupon, open, onOpenChange }: CouponFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [remainingParsedCoupons, setRemainingParsedCoupons] = useState<ParsedCoupon[]>([]);
  const [detectedCouponCount, setDetectedCouponCount] = useState(0);
  const [currentDetectedCoupon, setCurrentDetectedCoupon] = useState(0);
  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const setCouponTags = useSetCouponTags();
  const { data: existingTags } = useCouponTags(coupon?.id);
  const { data: dbCompanies } = useCompanies();
  const { user } = useAuth();

  const isEditing = !!coupon;
  const showAutoUsageUpdater = user?.id === 1;

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      company: coupon?.company || '',
      code: coupon?.code || '',
      value: coupon?.value || 0,
      cost: coupon?.cost || 0,
      used_value: coupon?.used_value || 0,
      description: coupon?.description || '',
      expiration: coupon?.expiration ? new Date(coupon.expiration).toISOString().split('T')[0] : '',
      is_available: coupon?.is_available ?? true,
      is_one_time: coupon?.is_one_time ?? false,
      purpose: coupon?.purpose || '',
      cvv: coupon?.cvv || '',
      card_exp: coupon?.card_exp || '',
      auto_download_details: normalizeAutoProvider(coupon?.auto_download_details, showAutoUsageUpdater),
      auto_update: Boolean(normalizeAutoProvider(coupon?.auto_download_details, showAutoUsageUpdater)),
    },
  });

  const watchedValue = form.watch('value');
  const watchedCost = form.watch('cost');
  const discountPercentage = watchedValue > 0
    ? Math.max(0, Math.min(100, ((watchedValue - watchedCost) / watchedValue) * 100))
    : 0;

  const companyNames = (dbCompanies || []).map((company) => company.name).filter(Boolean);

  useEffect(() => {
    if (!open) return;
    setRemainingParsedCoupons([]);
    setDetectedCouponCount(0);
    setCurrentDetectedCoupon(0);
    form.reset({
      company: coupon?.company || '',
      code: coupon?.code || '',
      value: coupon?.value || 0,
      cost: coupon?.cost || 0,
      used_value: coupon?.used_value || 0,
      description: coupon?.description || '',
      expiration: coupon?.expiration ? new Date(coupon.expiration).toISOString().split('T')[0] : '',
      is_available: coupon?.is_available ?? true,
      is_one_time: coupon?.is_one_time ?? false,
      purpose: coupon?.purpose || '',
      cvv: coupon?.cvv || '',
      card_exp: coupon?.card_exp || '',
      auto_download_details: normalizeAutoProvider(coupon?.auto_download_details, showAutoUsageUpdater),
      auto_update: Boolean(normalizeAutoProvider(coupon?.auto_download_details, showAutoUsageUpdater)),
    });
  }, [coupon, form, open, showAutoUsageUpdater]);

  useEffect(() => {
    if (open && existingTags) setTags(existingTags.map((t) => t.name));
    if (open && !coupon) setTags([]);
  }, [existingTags, open, coupon]);

  const fillFormFromParsedCoupon = (parsed: ParsedCoupon) => {
    const matchedCompany = parsed.company ? matchCompanyName(parsed.company, companyNames) : null;
    const autoProvider = normalizeAutoProvider(getDefaultAutoProvider(matchedCompany || parsed.company), showAutoUsageUpdater);
    form.reset({
      company: matchedCompany || parsed.company || '',
      code: parsed.code || '',
      value: parsed.value ?? 0,
      cost: parsed.cost ?? 0,
      used_value: 0,
      description: parsed.description || '',
      expiration: parsed.expiration?.split('T')[0] || '',
      is_available: true,
      is_one_time: false,
      purpose: '',
      cvv: parsed.cvv || '',
      card_exp: parsed.card_exp || '',
      auto_download_details: autoProvider,
      auto_update: Boolean(autoProvider),
    });
  };

  const handleParsed = (parsedCoupons: ParsedCoupon[]) => {
    const [firstCoupon, ...remainingCoupons] = parsedCoupons;
    if (!firstCoupon) return;

    setDetectedCouponCount(parsedCoupons.length);
    setCurrentDetectedCoupon(1);
    setRemainingParsedCoupons(remainingCoupons);
    fillFormFromParsedCoupon(firstCoupon);
  };

  const onSubmit = async (data: CouponFormValues) => {
    setIsSubmitting(true);
    try {
      const normalizedData = {
        ...data,
        purpose: data.is_one_time ? data.purpose || null : null,
        status: data.value > 0 && data.used_value >= data.value ? 'נוצל' : 'פעיל',
      };

      if (isEditing) {
        await updateCoupon.mutateAsync({
          id: coupon.id,
          updates: {
            ...normalizedData,
            expiration: data.expiration ? new Date(data.expiration).toISOString().split('T')[0] : null,
          }
        });
        await setCouponTags.mutateAsync({ couponId: coupon.id, tagNames: tags });
      } else {
        const created = await addCoupon.mutateAsync({
          ...normalizedData,
          date_added: new Date().toISOString(),
          expiration: data.expiration ? new Date(data.expiration).toISOString().split('T')[0] : null,
        });
        if (created?.id && tags.length) {
          await setCouponTags.mutateAsync({ couponId: created.id, tagNames: tags });
        }

        const [nextCoupon, ...couponsAfterNext] = remainingParsedCoupons;
        if (nextCoupon) {
          setRemainingParsedCoupons(couponsAfterNext);
          setCurrentDetectedCoupon((current) => current + 1);
          fillFormFromParsedCoupon(nextCoupon);
          return;
        }
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving coupon", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת קופון' : 'הוספת קופון חדש'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'עדכן את פרטי הקופון שלך כאן.' : 'הזן את פרטי הקופון החדש שלך.'} השדות המסומנים ב-* הם חובה.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
          {!isEditing && <AiParsePanel onParsed={handleParsed} companyNames={companyNames} />}

          {!isEditing && detectedCouponCount > 1 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm" role="status">
              <p className="font-medium">
                קופון {currentDetectedCoupon} מתוך {detectedCouponCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                בדוק את הפרטים ושמור. לאחר השמירה יוצג הקופון הבא שזוהה.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">חברה / מותג *</Label>
              <Input id="company" {...form.register("company")} disabled={isSubmitting} />
              {form.formState.errors.company && (
                <p className="text-sm text-destructive">{form.formState.errors.company.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">קוד קופון / מס' כרטיס *</Label>
              <Input id="code" className="text-start direction-ltr" {...form.register("code")} disabled={isSubmitting} />
              {form.formState.errors.code && (
                <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">שווי הקופון (₪) *</Label>
              <Input id="value" type="number" step="0.01" {...form.register("value")} disabled={isSubmitting} />
              {form.formState.errors.value && (
                <p className="text-sm text-destructive">{form.formState.errors.value.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">עלות בפועל (₪) *</Label>
              <Input id="cost" type="number" step="0.01" {...form.register("cost")} disabled={isSubmitting} />
              {form.formState.errors.cost && (
                <p className="text-sm text-destructive">{form.formState.errors.cost.message}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3" aria-live="polite">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>אחוז ההנחה</span>
                <span>{discountPercentage.toFixed(0)}%</span>
              </div>
              <Progress
                value={discountPercentage}
                className="h-3 bg-muted"
                aria-label={`אחוז ההנחה: ${discountPercentage.toFixed(0)}%`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="used_value">כמה כבר נוצל (₪)</Label>
              <Input id="used_value" type="number" step="0.01" {...form.register("used_value")} disabled={isSubmitting} />
              {form.formState.errors.used_value && (
                <p className="text-sm text-destructive">{form.formState.errors.used_value.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration">תוקף (אופציונלי)</Label>
              <Input id="expiration" type="date" {...form.register("expiration")} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvv">CVV (אופציונלי)</Label>
              <Input id="cvv" className="text-start direction-ltr" {...form.register("cvv")} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card_exp">תוקף כרטיס (MM/YY)</Label>
              <Input id="card_exp" className="text-start direction-ltr" {...form.register("card_exp")} disabled={isSubmitting} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור והערות (אופציונלי)</Label>
            <Textarea 
              id="description" 
              className="resize-none" 
              rows={3}
              {...form.register("description")}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>תגיות</Label>
            <TagsInput value={tags} onChange={setTags} disabled={isSubmitting} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox 
                id="is_available" 
                checked={form.watch("is_available")} 
                onCheckedChange={(checked) => form.setValue("is_available", checked as boolean)} 
                disabled={isSubmitting}
              />
              <Label htmlFor="is_available" className="font-normal cursor-pointer">
                קופון זמין לשימוש
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox 
                id="is_one_time" 
                checked={form.watch("is_one_time")} 
                onCheckedChange={(checked) => form.setValue("is_one_time", checked as boolean)} 
                disabled={isSubmitting}
              />
              <Label htmlFor="is_one_time" className="font-normal cursor-pointer">
                למימוש חד פעמי (לא ניתן לפצל)
              </Label>
            </div>

            {form.watch("is_one_time") && (
              <div className="space-y-2">
                <Label htmlFor="purpose">מטרת הקופון</Label>
                <Input id="purpose" {...form.register("purpose")} disabled={isSubmitting} />
              </div>
            )}

            {showAutoUsageUpdater && (
              <div className="space-y-2 pt-2 border-t mt-2">
                <Label htmlFor="auto_download_details" className="font-medium">עדכון שימוש אוטומטי</Label>
                <Select
                  value={form.watch("auto_download_details") || "none"}
                  onValueChange={(val) => {
                    const selected = val === "none" ? null : val;
                    form.setValue("auto_download_details", selected);
                    form.setValue("auto_update", selected !== null);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="auto_download_details" className="w-full">
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'שומר...'
                : isEditing
                  ? 'שמור שינויים'
                  : remainingParsedCoupons.length > 0
                    ? 'שמור ועבור לקופון הבא'
                    : 'הוסף קופון'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
