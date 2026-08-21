// TEMP dev-only preview route for the easter eggs. Delete when done looking.
import React from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { CouponCard } from "@/components/coupons/CouponCard";
import { CouponBarcodeView } from "@/components/coupons/CouponBarcodeView";

const base: any = {
  id: 1,
  company: "שופרסל",
  description: "כרטיס מתנה",
  code: "1234567890",
  value: 200,
  used_value: 60,
  status: "פעיל",
  expiration: "2026-12-31",
};

export default function EggPreview() {
  const [used, setUsed] = React.useState(false);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <TouchableOpacity
        onPress={() => setUsed((v) => !v)}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#2563eb" }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
          {used ? "החזר לפעיל" : "סמן כנוצל (חותמת)"}
        </Text>
      </TouchableOpacity>

      <CouponCard
        coupon={used ? { ...base, status: "נוצל", used_value: 200 } : base}
        onPress={() => {}}
      />
      <View>
        <CouponBarcodeView coupon={base} />
      </View>
      <View>
        <CouponBarcodeView coupon={{ ...base, used_value: 200 }} />
      </View>
    </ScrollView>
  );
}
