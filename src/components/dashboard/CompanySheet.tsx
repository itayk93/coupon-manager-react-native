import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { getCompanyColor, getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

type CompanySheetProps = {
  company: string | null;
  coupons: DecryptedCoupon[];
  onClose: () => void;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

function daysUntil(expiration: string | null) {
  if (!expiration) return null;
  const ms = new Date(expiration).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Bottom sheet listing one company's coupons — the `companyModal` in the
 * redesign: brand-coloured head with drag handle, logo and totals, then a
 * scrollable list of code / expiry / remaining rows.
 */
export function CompanySheet({ company, coupons, onClose }: CompanySheetProps) {
  const { theme } = useAppTheme();

  const rows = React.useMemo(
    () => coupons.filter((c) => c.company === company),
    [coupons, company]
  );

  const total = rows.reduce(
    (sum, c) => sum + Math.max(0, (c.value || 0) - (c.used_value || 0)),
    0
  );

  const brand = getCompanyColor(company || "");

  return (
    <Modal
      visible={company !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <TouchableOpacity style={styles.scrimTouch} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.head, { backgroundColor: brand }]}>
            <View style={styles.handle} />

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="סגירה">
              <X size={15} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.headRow}>
              <View style={[styles.logoFrame, { backgroundColor: theme.card }]}>
                <Image
                  source={getCompanyLogoSource(company || "")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text numberOfLines={1} style={styles.headTitle}>
                {company}
              </Text>
            </View>

            <Text style={styles.headMeta}>
              {rows.length} קופונים · יתרה {formatIls(total)}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {rows.map((c) => {
              const days = daysUntil(c.expiration);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 14;
              return (
                <View key={c.id} style={[styles.row, { borderBottomColor: theme.divider }]}>
                  <Text style={[styles.remaining, { color: theme.text }]}>
                    {formatIls(Math.max(0, (c.value || 0) - (c.used_value || 0)))}
                  </Text>

                  <View style={styles.rowStart}>
                    <Text style={[styles.code, { color: theme.text }]}>{c.code || "—"}</Text>
                    <Text
                      style={[
                        styles.days,
                        {
                          color: expired
                            ? theme.danger
                            : soon
                              ? theme.warning
                              : theme.success,
                        },
                      ]}
                    >
                      {expired
                        ? "פג תוקף"
                        : soon
                          ? `נותרו ${days} ימים`
                          : "בתוקף"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  scrimTouch: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
  },
  head: {
    padding: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignSelf: "center",
    marginBottom: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    left: 18,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  logoFrame: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "76%",
    height: "76%",
  },
  headTitle: {
    fontFamily: fonts.display,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    flexShrink: 1,
  },
  headMeta: {
    fontFamily: fonts.body,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowStart: {
    alignItems: "flex-start",
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    fontWeight: "700",
    writingDirection: "ltr",
  },
  days: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  remaining: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
});
