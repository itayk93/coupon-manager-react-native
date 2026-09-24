import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Layers, Plus, Building2, ChevronLeft } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompanyPickerModal } from "@/components/dashboard/CompanyPickerModal";
import { useAddCoupon } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useContentStyle } from "@/hooks/useResponsive";
import { notify } from "@/lib/notify";
import { runPool } from "@/lib/runPool";

/** Codes sent to the vault at once during a bulk import. */
const BULK_IMPORT_CONCURRENCY = 4;

export function BulkImportScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const contentStyle = useContentStyle("reading");
  const addCoupon = useAddCoupon();

  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [cost, setCost] = useState("0");
  const [expiration, setExpiration] = useState("");
  const [bulkCodes, setBulkCodes] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBulkImport = async () => {
    if (!company.trim()) {
      notify.error("יש לבחור חברה");
      return;
    }
    const lines = bulkCodes
      .split(/[\n,]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (lines.length === 0) {
      notify.error("יש להזין לפחות קוד קופון אחד");
      return;
    }

    const numValue = Number(value) || 0;
    const numCost = Number(cost) || 0;
    setLoading(true);

    try {
      // A few codes go out at once instead of one round trip after another —
      // fifty codes used to mean fifty waits in a row. The pool stays small so
      // the vault is not flooded, and one bad code no longer stops the rest.
      const { failed, firstError } = await runPool(lines, BULK_IMPORT_CONCURRENCY, (code) =>
        addCoupon.mutateAsync({
          company: company.trim(),
          code: code,
          value: numValue,
          cost: numCost,
          expiration: expiration.trim() || null,
          used_value: 0,
          status: "פעיל",
        })
      );

      if (failed.length) {
        // Only the failed codes stay in the box, so trying again cannot
        // import the successful ones a second time.
        setBulkCodes(failed.join("\n"));
        notify.error(
          "שגיאה בייבוא מרובה",
          `${lines.length - failed.length} מתוך ${lines.length} קודים יובאו. נכשלו: ${failed.join(", ")}${firstError instanceof Error ? ` (${firstError.message})` : ""}`
        );
        return;
      }

      // Nothing in the app links here, so the screen is usually opened from a
      // URL with no history behind it; back() alone would leave the user on
      // a finished import.
      if (router.canGoBack()) router.back();
      else router.replace("/coupons");
    } catch (e: any) {
      notify.error("שגיאה בייבוא מרובה", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="ייבוא קופונים מרובה" showBack onBack={() => router.back()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, contentStyle]}
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
          <Text style={[styles.fieldLabel, { color: theme.text }]}>חברה / רשת *</Text>
          <TouchableOpacity
            onPress={() => setIsCompanyPickerOpen(true)}
            style={[
              styles.companySelector,
              { backgroundColor: theme.inputBg, borderColor: theme.border },
            ]}
          >
            <ChevronLeft size={18} color={theme.textMuted} />
            <Text style={[styles.companyText, { color: company ? theme.text : theme.textMuted }]}>
              {company || "בחר חברה..."}
            </Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="עלות ליחידה (₪)"
                placeholder="0"
                keyboardType="numeric"
                value={cost}
                onChangeText={setCost}
              />
            </View>
            <View style={styles.halfCol}>
              <Input
                label="שווי ליחידה (₪) *"
                placeholder="100"
                keyboardType="numeric"
                value={value}
                onChangeText={setValue}
              />
            </View>
          </View>

          <Input
            label="תאריך תפוגה (YYYY-MM-DD)"
            placeholder="2026-12-31"
            value={expiration}
            onChangeText={setExpiration}
          />

          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            רשימת קודי קופונים (כל קוד בשורה חדשה) *
          </Text>
          <TextInput
            multiline
            numberOfLines={8}
            placeholder={`111222333\n444555666\n777888999`}
            placeholderTextColor={theme.textMuted}
            value={bulkCodes}
            onChangeText={setBulkCodes}
            style={[
              styles.bulkInput,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Button
            title="ייבא קופונים לארנק"
            onPress={handleBulkImport}
            loading={loading}
            icon={<Layers size={18} color="#ffffff" />}
            style={{ marginTop: 16 }}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 22,
    padding: 18,
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
    borderWidth: 1,
    marginBottom: 14,
  },
  companyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  bulkInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    height: 160,
    textAlignVertical: "top",
    textAlign: "right",
    fontSize: 14,
    lineHeight: 22,
  },
});
