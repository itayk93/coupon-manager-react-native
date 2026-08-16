import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DecryptedCoupon } from "@/hooks/useCoupons";
import { useRecordUsage } from "@/hooks/useCouponUsage";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";

type QuickUsageModalProps = {
  visible: boolean;
  onClose: () => void;
  coupons: DecryptedCoupon[];
  preselectedCoupon?: DecryptedCoupon | null;
};

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function QuickUsageModal({
  visible,
  onClose,
  coupons,
  preselectedCoupon,
}: QuickUsageModalProps) {
  const { theme } = useAppTheme();
  const recordUsage = useRecordUsage();

  const activeCoupons = coupons.filter(
    (c) => !c.is_for_sale && c.status !== "נוצל"
  );

  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(
    preselectedCoupon ? preselectedCoupon.id : activeCoupons[0]?.id || null
  );
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState("");

  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId);
  const remaining = selectedCoupon
    ? Math.max(0, (selectedCoupon.value || 0) - (selectedCoupon.used_value || 0))
    : 0;

  const handleFullUsage = () => {
    if (remaining > 0) {
      setAmount(String(remaining));
    }
  };

  const handleSubmit = async () => {
    if (!selectedCouponId) {
      setError("יש לבחור קופון לדיווח");
      return;
    }
    const numAmount = Number(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      setError("יש להזין סכום שימוש חיובי");
      return;
    }
    if (numAmount > remaining) {
      setError(`הסכום שהוזן (${formatIls(numAmount)}) גבוה מהיתרה (${formatIls(remaining)})`);
      return;
    }

    try {
      await recordUsage.mutateAsync({
        couponId: selectedCouponId,
        usedAmount: numAmount,
        details: details.trim() || "שימוש מהיר באפליקציה",
      });
      setAmount("");
      setDetails("");
      setError("");
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="דיווח מהיר על שימוש"
      subtitle="הורד סכום שנוצל מיתרת הקופון"
    >
      <View style={styles.container}>
        {/* Coupon Selector */}
        <Text style={[styles.label, { color: theme.text }]}>בחר קופון</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsPickerOpen(!isPickerOpen)}
          style={[
            styles.couponSelector,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.border,
            },
          ]}
        >
          <ChevronDown size={18} color={theme.textMuted} />
          {selectedCoupon ? (
            <View style={styles.selectedCouponRow}>
              <View style={styles.selectedTextGroup}>
                <Text
                  numberOfLines={1}
                  style={[styles.couponName, { color: theme.text }]}
                >
                  {selectedCoupon.company}
                </Text>
                <Text style={[styles.couponBalance, { color: theme.primary }]}>
                  יתרה: {formatIls(remaining)}
                </Text>
              </View>
              <Image
                source={{ uri: getCompanyLogo(selectedCoupon.company) }}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              לא נבחרו קופונים
            </Text>
          )}
        </TouchableOpacity>

        {/* Dropdown list if opened */}
        {isPickerOpen ? (
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <FlatList
              data={activeCoupons}
              keyExtractor={(c) => String(c.id)}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => {
                const rem = Math.max(0, (item.value || 0) - (item.used_value || 0));
                const isCurrent = item.id === selectedCouponId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCouponId(item.id);
                      setIsPickerOpen(false);
                      setError("");
                    }}
                    style={[
                      styles.dropdownItem,
                      {
                        backgroundColor: isCurrent
                          ? theme.primaryMuted
                          : "transparent",
                      },
                    ]}
                  >
                    {isCurrent ? (
                      <Check size={16} color={theme.primary} />
                    ) : (
                      <View style={{ width: 16 }} />
                    )}
                    <View style={styles.itemInfo}>
                      <Text
                        numberOfLines={1}
                        style={[styles.itemName, { color: theme.text }]}
                      >
                        {item.company} ({item.code ? "•••" + item.code.slice(-4) : ""})
                      </Text>
                      <Text
                        style={[styles.itemSub, { color: theme.textMuted }]}
                      >
                        יתרה: {formatIls(rem)}
                      </Text>
                    </View>
                    <Image
                      source={{ uri: getCompanyLogo(item.company) }}
                      style={styles.itemLogo}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}

        {/* Amount Input */}
        <View style={styles.amountContainer}>
          <Input
            label="סכום השימוש (₪) *"
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={(val) => {
              setAmount(val);
              setError("");
            }}
            error={error}
          />
          {remaining > 0 ? (
            <TouchableOpacity
              onPress={handleFullUsage}
              style={[
                styles.fullUseBtn,
                { backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Text style={[styles.fullUseText, { color: theme.primary }]}>
                שימוש במלוא היתרה ({formatIls(remaining)})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Details Input */}
        <Input
          label="פרטים / מיקום (אופציונלי)"
          placeholder="למשל: סניף קניון עזריאלי"
          value={details}
          onChangeText={setDetails}
        />

        <Button
          title="רשום שימוש ועדכן יתרה"
          onPress={handleSubmit}
          loading={recordUsage.isPending}
          style={{ marginTop: 12 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "right",
  },
  couponSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  selectedCouponRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  selectedTextGroup: {
    alignItems: "flex-end",
  },
  couponName: {
    fontSize: 14,
    fontWeight: "700",
  },
  couponBalance: {
    fontSize: 12,
    fontWeight: "600",
  },
  placeholderText: {
    fontSize: 14,
  },
  dropdown: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: -8,
    marginBottom: 14,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  itemInfo: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  amountContainer: {
    marginBottom: 4,
  },
  fullUseBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  fullUseText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
