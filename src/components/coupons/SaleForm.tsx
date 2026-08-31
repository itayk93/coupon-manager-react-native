import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { useCouponSales, type SaleInput } from "@/hooks/useCouponSales";

type Contact = { name: string; phone: string; email: string };

function useBuyerContacts(): Contact[] {
  const { data: sales = [] } = useCouponSales();
  return React.useMemo(() => {
    const byKey = new Map<string, Contact>();
    for (const sale of sales) {
      const name = (sale.buyer_name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      // Newest sale wins the phone/email, but keep any detail we already have.
      byKey.set(key, {
        name,
        phone: sale.buyer_phone || existing?.phone || "",
        email: sale.buyer_email || existing?.email || "",
      });
    }
    return Array.from(byKey.values());
  }, [sales]);
}

export function SaleForm({ busy, submitTitle, initialEmail = "", onSubmit }: {
  busy: boolean;
  submitTitle: string;
  initialEmail?: string;
  onSubmit: (sale: SaleInput) => void;
}) {
  const { theme } = useAppTheme();
  const contacts = useBuyerContacts();
  const [price, setPrice] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(initialEmail);
  const [picked, setPicked] = React.useState(false);
  const [error, setError] = React.useState("");

  const query = name.trim().toLowerCase();
  const suggestions = picked || !query
    ? []
    : contacts.filter((c) => c.name.toLowerCase().includes(query) && c.name.toLowerCase() !== query).slice(0, 5);

  const pick = (c: Contact) => {
    setName(c.name);
    if (c.phone) setPhone(c.phone);
    if (c.email) setEmail(c.email);
    setPicked(true);
  };

  const submit = () => {
    const salePrice = price.trim() ? Number(price.replace(",", ".")) : 0;
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      setError("סכום המכירה אינו תקין");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("כתובת האימייל אינה תקינה");
      return;
    }
    setError("");
    onSubmit({
      salePrice,
      buyerName: name.trim() || undefined,
      buyerPhone: phone.trim() || undefined,
      buyerEmail: email.trim() || undefined,
    });
  };

  return <View style={styles.form}>
    <Input label="בכמה מכרתי (רשות)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={error} />
    <View>
      <Input
        label="שם מלא (רשות)"
        value={name}
        onChangeText={(text) => { setName(text); setPicked(false); }}
      />
      {suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {suggestions.map((c) => (
            <Pressable key={c.name} onPress={() => pick(c)} style={styles.suggestion}>
              <Text style={[styles.suggestionName, { color: theme.text }]}>{c.name}</Text>
              {c.phone || c.email ? (
                <Text style={[styles.suggestionMeta, { color: theme.textMuted }]}>
                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
    <Input label="טלפון (רשות)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    <Input label="אימייל (רשות)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
    <Button title={submitTitle} onPress={submit} loading={busy} disabled={busy} />
  </View>;
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  suggestions: { marginTop: -6, marginBottom: 4, borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  suggestion: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  suggestionName: { fontFamily: fonts.bodyBold, fontSize: 14, textAlign: "right" },
  suggestionMeta: { fontFamily: fonts.body, fontSize: 12, textAlign: "right" },
});
