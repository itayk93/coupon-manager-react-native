import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Building2, ChevronLeft, Tag as TagIcon, Plus, X } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/DateField";
import { Button } from "@/components/ui/button";
import { CompanyPickerModal } from "@/components/dashboard/CompanyPickerModal";
import {
  useAddCoupon,
  useCoupon,
  useUpdateCoupon,
  DecryptedCoupon,
} from "@/hooks/useCoupons";
import { useCouponTags, useSetCouponTags } from "@/hooks/useTags";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";

type CouponFormProps = {
  existingCoupon?: DecryptedCoupon;
  initialCompany?: string;
  initialCode?: string;
  initialValue?: string;
  initialExpiration?: string;
  initialDescription?: string;
};

/**
 * Providers the balance scraper knows how to log into. Kept in sync with the
 * web form (`src/components/coupons/CouponForm.tsx`).
 */
const AUTO_PROVIDERS = ["BuyMe", "Multipass", "Max"] as const;
type AutoProvider = (typeof AUTO_PROVIDERS)[number];

function normalizeAutoProvider(
  value: string | null | undefined,
  allowAutoUpdater: boolean
): AutoProvider | null {
  if (!allowAutoUpdater) return null;
  return AUTO_PROVIDERS.includes(value as AutoProvider)
    ? (value as AutoProvider)
    : null;
}

function getDefaultAutoProvider(
  company: string | null | undefined
): AutoProvider | null {
  const name = company?.trim().toLowerCase() || "";
  if (name.includes("buyme") || name.includes("ביימי")) return "BuyMe";
  if (name.includes("multipass") || name.includes("מולטיפאס")) return "Multipass";
  if (name.includes("max") || name.includes("מקס")) return "Max";
  if (name.includes("xtra") || name.includes("אקסטרה")) return "Multipass";
  return null;
}

/**
 * Route entry for both `/coupons/add` and `/coupons/edit?couponId=`.
 *
 * Edit mode only receives the coupon id over the URL, so the coupon is fetched
 * by id here and the form is mounted once the data is available. That keeps the
 * form's state initialisers synchronous and avoids syncing props into state.
 */
export function AddEditCouponScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    couponId?: string;
    initialCompany?: string;
    initialCode?: string;
    initialValue?: string;
    initialExpiration?: string;
    initialDescription?: string;
  }>();

  const parsedId = Number(params.couponId);
  const couponId = Number.isInteger(parsedId) ? parsedId : undefined;
  const isEditing = couponId !== undefined;

  const { data: existingCoupon, isLoading, isError } = useCoupon(couponId);

  if (isEditing && (isLoading || (!existingCoupon && !isError))) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="עריכת קופון" showBack onBack={() => router.back()} />
        <View style={styles.stateContainer}>
          <Text style={{ color: theme.textMuted }}>טוען נתוני קופון...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isEditing && !existingCoupon) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Header title="עריכת קופון" showBack onBack={() => router.back()} />
        <View style={styles.stateContainer}>
          <Text style={{ color: theme.danger }}>לא ניתן לטעון את הקופון לעריכה</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <CouponForm
      existingCoupon={existingCoupon}
      initialCompany={params.initialCompany}
      initialCode={params.initialCode}
      initialValue={params.initialValue}
      initialExpiration={params.initialExpiration}
      initialDescription={params.initialDescription}
    />
  );
}

function CouponForm({
  existingCoupon,
  initialCompany,
  initialCode,
  initialValue,
  initialExpiration,
  initialDescription,
}: CouponFormProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const isEditing = existingCoupon !== undefined;

  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const setCouponTags = useSetCouponTags();
  const { data: existingTags = [] } = useCouponTags(existingCoupon?.id);
  const { user } = useAuth();
  const showAutoUsageUpdater = user?.id === 1;

  const [company, setCompany] = useState(
    existingCoupon?.company || initialCompany || ""
  );
  const [code, setCode] = useState(existingCoupon?.code || initialCode || "");
  const [value, setValue] = useState(
    existingCoupon?.value ? String(existingCoupon.value) : initialValue || ""
  );
  const [cost, setCost] = useState(
    existingCoupon?.cost !== undefined ? String(existingCoupon.cost) : "0"
  );
  // Sliced to `YYYY-MM-DD`: the date field (and the column) only carry the day,
  // but older rows can come back with a time component attached.
  const [expiration, setExpiration] = useState(
    (existingCoupon?.expiration || initialExpiration || "").slice(0, 10)
  );
  const [description, setDescription] = useState(
    existingCoupon?.description || initialDescription || ""
  );
  const [includeCardInfo, setIncludeCardInfo] = useState(
    Boolean(existingCoupon?.cvv || existingCoupon?.card_exp)
  );
  const [cvv, setCvv] = useState(existingCoupon?.cvv || "");
  const [cardExp, setCardExp] = useState(existingCoupon?.card_exp || "");
  // The automatic balance updater only runs for the maintainer's own account,
  // so everyone else stores `auto_download_details: null` and never sees it.
  const [autoProvider, setAutoProvider] = useState<AutoProvider | null>(() =>
    normalizeAutoProvider(
      existingCoupon?.auto_download_details ??
        getDefaultAutoProvider(existingCoupon?.company || initialCompany),
      showAutoUsageUpdater
    )
  );
  const [redemptionUrl, setRedemptionUrl] = useState(
    existingCoupon?.buyme_coupon_url ||
      existingCoupon?.strauss_coupon_url ||
      existingCoupon?.xgiftcard_coupon_url ||
      existingCoupon?.xtra_coupon_url ||
      ""
  );

  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingTags.length > 0) {
      setTags(existingTags.map((t) => t.name));
    }
  }, [existingTags]);

  // Picking a company suggests its provider, but never overrides an explicit
  // choice the user already made.
  const handleSelectCompany = (name: string) => {
    setCompany(name);
    if (showAutoUsageUpdater && !autoProvider) {
      setAutoProvider(getDefaultAutoProvider(name));
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter((t) => t !== tagName));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!company.trim()) errs.company = "יש לבחור או להזין חברה";
    if (!code.trim()) errs.code = "קוד קופון הוא שדה חובה";
    if (!value.trim() || isNaN(Number(value)) || Number(value) < 0) {
      errs.value = "יש להזין שווי תקין בש״ח";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (isEditing && existingCoupon) {
        await updateCoupon.mutateAsync({
          id: existingCoupon.id,
          updates: {
            company: company.trim(),
            code: code.trim(),
            value: Number(value) || 0,
            cost: Number(cost) || 0,
            expiration: expiration.trim() || null,
            description: description.trim() || null,
            cvv: includeCardInfo ? cvv.trim() || null : null,
            card_exp: includeCardInfo ? cardExp.trim() || null : null,
            buyme_coupon_url: redemptionUrl.trim() || null,
            auto_download_details: showAutoUsageUpdater ? autoProvider : null,
            auto_update: showAutoUsageUpdater ? autoProvider !== null : false,
          },
        });

        await setCouponTags.mutateAsync({
          couponId: existingCoupon.id,
          tagNames: tags,
        });

        router.back();
      } else {
        const created = await addCoupon.mutateAsync({
          company: company.trim(),
          code: code.trim(),
          value: Number(value) || 0,
          cost: Number(cost) || 0,
          expiration: expiration.trim() || null,
          description: description.trim() || null,
          cvv: includeCardInfo ? cvv.trim() || null : null,
          card_exp: includeCardInfo ? cardExp.trim() || null : null,
          buyme_coupon_url: redemptionUrl.trim() || null,
          auto_download_details: showAutoUsageUpdater ? autoProvider : null,
          auto_update: showAutoUsageUpdater ? autoProvider !== null : false,
          used_value: 0,
          status: "פעיל",
        });

        const couponId = (created as any)?.id;
        if (couponId && tags.length > 0) {
          await setCouponTags.mutateAsync({
            couponId,
            tagNames: tags,
          });
        }

        router.back();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title={isEditing ? "עריכת קופון" : "הוספת קופון חדש"}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Company Picker */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            חברה / רשת *
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsCompanyPickerOpen(true)}
            style={[
              styles.companySelector,
              {
                backgroundColor: theme.inputBg,
                borderColor: errors.company ? theme.danger : theme.border,
              },
            ]}
          >
            <ChevronLeft size={18} color={theme.textMuted} />
            <View style={styles.selectedCompanyPreview}>
              <Text
                style={[
                  styles.companySelectorText,
                  { color: company ? theme.text : theme.textMuted },
                ]}
              >
                {company || "בחר חברה מרשימה..."}
              </Text>
              {company ? (
                <Image
                  source={getCompanyLogoSource(company)}
                  style={styles.selectedLogo}
                  resizeMode="contain"
                />
              ) : (
                <Building2 size={20} color={theme.textMuted} />
              )}
            </View>
          </TouchableOpacity>
          {errors.company ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {errors.company}
            </Text>
          ) : null}

          {/* Code */}
          <Input
            label="קוד הקופון *"
            placeholder="קוד הקופון..."
            value={code}
            onChangeText={setCode}
            error={errors.code}
          />

          {/* Value & Cost */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="עלות הקנייה (₪)"
                placeholder="0.00"
                keyboardType="numeric"
                value={cost}
                onChangeText={setCost}
              />
            </View>
            <View style={styles.halfCol}>
              <Input
                label="שווי הקופון (₪) *"
                placeholder="0.00"
                keyboardType="numeric"
                value={value}
                onChangeText={setValue}
                error={errors.value}
              />
            </View>
          </View>

          {/* Expiration */}
          <DateField
            label="תאריך תפוגה"
            value={expiration}
            onChange={setExpiration}
            placeholder="בחירת תאריך"
            helperText="בחירה מלוח השנה (פורמט: שנה-חודש-יום)"
          />

          {/* Description */}
          <Input
            label="תיאור / הערות"
            placeholder="למשל: תקף בסניפים בלבד..."
            value={description}
            onChangeText={setDescription}
          />

          {/* Redemption URL */}
          <Input
            label="קישור למימוש מקוון (URL)"
            placeholder="https://..."
            value={redemptionUrl}
            onChangeText={setRedemptionUrl}
            helperText="קישור ישיר לאתר BuyMe או דף השובר"
          />

          {/* Card Info Switch */}
          <View
            style={[
              styles.switchRow,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: theme.border,
              },
            ]}
          >
            <Switch
              value={includeCardInfo}
              onValueChange={setIncludeCardInfo}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              thumbColor="#ffffff"
            />
            <View style={styles.switchLabelContainer}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>
                הוספת פרטי כרטיס (CVV / תוקף)
              </Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                לקופונים הדורשים קוד אבטחה בקופה
              </Text>
            </View>
          </View>

          {includeCardInfo ? (
            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Input
                  label="תוקף כרטיס (MM/YY)"
                  placeholder="08/28"
                  value={cardExp}
                  onChangeText={setCardExp}
                />
              </View>
              <View style={styles.halfCol}>
                <Input
                  label="CVV / קוד סודי"
                  placeholder="123"
                  keyboardType="numeric"
                  value={cvv}
                  onChangeText={setCvv}
                />
              </View>
            </View>
          ) : null}

          {/* Auto usage updater — maintainer account only */}
          {showAutoUsageUpdater ? (
            <View
              style={[
                styles.autoProviderCard,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.switchLabel, { color: theme.text }]}>
                עדכון יתרה אוטומטי
              </Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                בחירת ספק למשיכת יתרה עדכנית באופן אוטומטי
              </Text>
              <View style={styles.autoProviderRow}>
                {[null, ...AUTO_PROVIDERS].map((provider) => {
                  const isSelected = autoProvider === provider;
                  return (
                    <TouchableOpacity
                      key={provider ?? "none"}
                      onPress={() => setAutoProvider(provider)}
                      style={[
                        styles.autoProviderChip,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.surface,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.autoProviderChipText,
                          { color: isSelected ? "#ffffff" : theme.text },
                        ]}
                      >
                        {provider ?? "ללא"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Tags Section */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>תגיות</Text>
          <View style={styles.addTagRow}>
            <TouchableOpacity
              onPress={handleAddTag}
              style={[styles.addTagBtn, { backgroundColor: theme.primary }]}
            >
              <Plus size={18} color="#ffffff" />
            </TouchableOpacity>
            <Input
              placeholder="הוסף תגית..."
              value={newTagInput}
              onChangeText={setNewTagInput}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
          </View>

          <View style={styles.tagsContainer}>
            {tags.map((t) => (
              <View
                key={t}
                style={[
                  styles.tagBadge,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                  <X size={14} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.tagBadgeText, { color: theme.primary }]}>
                  #{t}
                </Text>
              </View>
            ))}
          </View>

          <Button
            title={isEditing ? "שמור שינויים" : "הוסף קופון לארנק"}
            onPress={handleSubmit}
            loading={addCoupon.isPending || updateCoupon.isPending}
            style={{ marginTop: 18 }}
          />
        </View>
      </ScrollView>

      <CompanyPickerModal
        visible={isCompanyPickerOpen}
        onClose={() => setIsCompanyPickerOpen(false)}
        onSelect={handleSelectCompany}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "right",
  },
  companySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  selectedCompanyPreview: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  selectedLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  companySelectorText: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    textAlign: "right",
  },
  row: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  switchLabelContainer: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  autoProviderCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    alignItems: "flex-end",
  },
  autoProviderRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  autoProviderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  autoProviderChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  addTagRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  addTagBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsContainer: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tagBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
