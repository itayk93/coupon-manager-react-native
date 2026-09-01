import React from "react";
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
import { Building2, ChevronDown, ChevronLeft, Plus, X } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/DateField";
import { Button } from "@/components/ui/button";
import { CompanyPickerModal } from "@/components/dashboard/CompanyPickerModal";
import { useCoupon, DecryptedCoupon } from "@/hooks/useCoupons";
import { useCouponForm } from "@/hooks/useCouponForm";
import { AUTO_PROVIDERS } from "@/lib/couponForm";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getSharedCouponImport } from "@/lib/sharedCouponImport";

type CouponFormProps = {
  existingCoupon?: DecryptedCoupon;
  initialCompany?: string;
  initialCode?: string;
  initialValue?: string;
  initialCost?: string;
  initialExpiration?: string;
  initialDescription?: string;
  initialCvv?: string;
  initialCardExp?: string;
  initialRedemptionUrl?: string;
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
    initialCost?: string;
    initialExpiration?: string;
    initialDescription?: string;
    initialCvv?: string;
    initialCardExp?: string;
    initialImportId?: string;
    initialRedemptionUrl?: string;
  }>();

  const couponIdentifier = params.couponId;
  const isEditing = couponIdentifier !== undefined;
  const importedCoupon = getSharedCouponImport(params.initialImportId);

  const { data: existingCoupon, isLoading, isError } = useCoupon(couponIdentifier);

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
      key={params.initialImportId || couponIdentifier || "new-coupon"}
      existingCoupon={existingCoupon}
      initialCompany={importedCoupon?.company || params.initialCompany}
      initialCode={importedCoupon?.code || params.initialCode}
      initialValue={importedCoupon?.value ? String(importedCoupon.value) : params.initialValue}
      initialCost={importedCoupon?.cost ? String(importedCoupon.cost) : params.initialCost}
      initialExpiration={importedCoupon?.expiration?.slice(0, 10) || params.initialExpiration}
      initialDescription={importedCoupon?.description || params.initialDescription}
      initialCvv={importedCoupon?.cvv || params.initialCvv}
      initialCardExp={importedCoupon?.card_exp || params.initialCardExp}
      initialRedemptionUrl={importedCoupon?.redemption_url || params.initialRedemptionUrl}
    />
  );
}

function CouponForm({
  existingCoupon,
  initialCompany,
  initialCode,
  initialValue,
  initialCost,
  initialExpiration,
  initialDescription,
  initialCvv,
  initialCardExp,
  initialRedemptionUrl,
}: CouponFormProps) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = React.useState(Boolean(existingCoupon));

  const {
    isEditing,
    showAutoUsageUpdater,
    isSaving,
    canSubmit,
    company,
    code,
    setCode,
    value,
    setValue,
    cost,
    setCost,
    expiration,
    setExpiration,
    isOneTime,
    setIsOneTime,
    purpose,
    setPurpose,
    description,
    setDescription,
    includeCardInfo,
    setIncludeCardInfo,
    cvv,
    setCvv,
    cardExp,
    setCardExp,
    autoProvider,
    setAutoProvider,
    redemptionUrl,
    setRedemptionUrl,
    tags,
    newTagInput,
    setNewTagInput,
    handleAddTag,
    handleRemoveTag,
    isCompanyPickerOpen,
    setIsCompanyPickerOpen,
    handleSelectCompany,
    errors,
    handleSubmit,
  } = useCouponForm({
    existingCoupon,
    initialCompany,
    initialCode,
    initialValue,
    initialCost,
    initialExpiration,
    initialDescription,
    initialCvv,
    initialCardExp,
    initialRedemptionUrl,
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header
        title={isEditing ? "עריכת קופון" : "הוספת קופון"}
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
              value={isOneTime}
              onValueChange={(enabled) => {
                setIsOneTime(enabled);
                if (!enabled) setPurpose("");
              }}
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              thumbColor="#ffffff"
            />
            <View style={styles.switchLabelContainer}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>קופון חד־פעמי</Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>הקופון מיועד למימוש אחד בלבד</Text>
            </View>
          </View>

          {isOneTime ? (
            <Input
              label="מטרת הקופון"
              placeholder="למשל: ארוחת ערב, מתנה..."
              value={purpose}
              onChangeText={setPurpose}
              autoFocus
            />
          ) : null}

          <TouchableOpacity
            onPress={() => setShowAdvanced((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            style={[styles.advancedToggle, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          >
            <ChevronDown
              size={18}
              color={theme.primary}
              style={{ transform: [{ rotate: showAdvanced ? "180deg" : "0deg" }] }}
            />
            <View style={styles.switchLabelContainer}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>פרטים נוספים</Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>הערות, קישור, פרטי כרטיס, עדכון אוטומטי ותגיות</Text>
            </View>
          </TouchableOpacity>

          {showAdvanced ? <>

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
          </> : null}

          <Button
            title={isEditing ? "שמור שינויים" : "הוסף קופון לארנק"}
            onPress={handleSubmit}
            loading={isSaving}
            disabled={!canSubmit || isSaving}
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
  advancedToggle: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
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
