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
import { Button } from "@/components/ui/button";
import { CompanyPickerModal } from "@/components/dashboard/CompanyPickerModal";
import {
  useAddCoupon,
  useCoupon,
  useUpdateCoupon,
  DecryptedCoupon,
} from "@/hooks/useCoupons";
import { useCouponTags, useSetCouponTags } from "@/hooks/useTags";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";

type CouponFormProps = {
  existingCoupon?: DecryptedCoupon;
  initialCompany?: string;
  initialCode?: string;
  initialValue?: string;
};

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
    />
  );
}

function CouponForm({
  existingCoupon,
  initialCompany,
  initialCode,
  initialValue,
}: CouponFormProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const isEditing = existingCoupon !== undefined;

  const addCoupon = useAddCoupon();
  const updateCoupon = useUpdateCoupon();
  const setCouponTags = useSetCouponTags();
  const { data: existingTags = [] } = useCouponTags(existingCoupon?.id);

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
  const [expiration, setExpiration] = useState(existingCoupon?.expiration || "");
  const [description, setDescription] = useState(
    existingCoupon?.description || ""
  );
  const [includeCardInfo, setIncludeCardInfo] = useState(
    Boolean(existingCoupon?.cvv || existingCoupon?.card_exp)
  );
  const [cvv, setCvv] = useState(existingCoupon?.cvv || "");
  const [cardExp, setCardExp] = useState(existingCoupon?.card_exp || "");
  const [autoUpdate, setAutoUpdate] = useState(
    existingCoupon?.auto_update !== undefined
      ? existingCoupon.auto_update
      : true
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
            auto_update: autoUpdate,
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
          auto_update: autoUpdate,
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
                  source={{ uri: getCompanyLogo(company) }}
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
          <Input
            label="תאריך תפוגה (YYYY-MM-DD)"
            placeholder="2026-12-31"
            value={expiration}
            onChangeText={setExpiration}
            helperText="פורמט: שנה-חודש-יום"
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
              trackColor={{ false: "#767577", true: theme.primary }}
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

          {/* Auto Update Switch */}
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
              value={autoUpdate}
              onValueChange={setAutoUpdate}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#ffffff"
            />
            <View style={styles.switchLabelContainer}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>
                עדכון יתרה אוטומטי
              </Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                משיכת יתרה עדכנית באופן אוטומטי
              </Text>
            </View>
          </View>

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
        onSelect={setCompany}
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
