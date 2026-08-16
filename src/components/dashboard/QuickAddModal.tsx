import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
} from "react-native";
import { ChevronLeft, Sparkles, Building2 } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompanyPickerModal } from "./CompanyPickerModal";
import { useAddCoupon } from "@/hooks/useCoupons";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";

type QuickAddModalProps = {
  visible: boolean;
  onClose: () => void;
  initialCompany?: string;
  initialCode?: string;
  initialValue?: number;
};

export function QuickAddModal({
  visible,
  onClose,
  initialCompany = "",
  initialCode = "",
  initialValue,
}: QuickAddModalProps) {
  const { theme } = useAppTheme();
  const addCoupon = useAddCoupon();

  const [company, setCompany] = useState(initialCompany);
  const [code, setCode] = useState(initialCode);
  const [value, setValue] = useState(initialValue ? String(initialValue) : "");
  const [cost, setCost] = useState("0");
  const [expiration, setExpiration] = useState("");
  const [description, setDescription] = useState("");
  const [includeCardInfo, setIncludeCardInfo] = useState(false);
  const [cvv, setCvv] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);

  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      await addCoupon.mutateAsync({
        company: company.trim(),
        code: code.trim(),
        value: Number(value) || 0,
        cost: Number(cost) || 0,
        expiration: expiration.trim() || null,
        description: description.trim() || null,
        cvv: includeCardInfo ? cvv.trim() || null : null,
        card_exp: includeCardInfo ? cardExp.trim() || null : null,
        auto_update: autoUpdate,
        used_value: 0,
        status: "פעיל",
      });

      // Reset
      setCompany("");
      setCode("");
      setValue("");
      setCost("0");
      setExpiration("");
      setDescription("");
      setIncludeCardInfo(false);
      setCvv("");
      setCardExp("");
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        onClose={onClose}
        title="הוספת קופון מהירה"
        subtitle="הזן את פרטי הקופון לשמירה בארנק"
      >
        <View style={styles.form}>
          {/* Company Selector */}
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            חברה / רשת
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
            placeholder="הזן או הדבק קוד..."
            value={code}
            onChangeText={setCode}
            error={errors.code}
          />

          {/* Value & Cost in Row */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="עלות (₪)"
                placeholder="כמה שילמת?"
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
            helperText="אופציונלי - להתראות לפני סיום התוקף"
          />

          {/* Description */}
          <Input
            label="תיאור / הערות"
            placeholder="למשל: תקף בסניפים בלבד..."
            value={description}
            onChangeText={setDescription}
          />

          {/* Card Info Toggle */}
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

          {/* Auto Update */}
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
              trackColor={{ false: theme.inputBorder, true: theme.primary }}
              thumbColor="#ffffff"
            />
            <View style={styles.switchLabelContainer}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>
                עדכון יתרה אוטומטי
              </Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                תמיכה ב-BuyMe, מולטיפאס, מקס
              </Text>
            </View>
          </View>

          <Button
            title="שמור קופון בארנק"
            onPress={handleSubmit}
            loading={addCoupon.isPending}
            style={styles.submitBtn}
          />
        </View>
      </Modal>

      <CompanyPickerModal
        visible={isCompanyPickerOpen}
        onClose={() => setIsCompanyPickerOpen(false)}
        onSelect={setCompany}
      />
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingVertical: 4,
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
  submitBtn: {
    marginTop: 10,
  },
});
