import React from "react";
import { StyleSheet, View } from "react-native";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SaleInput } from "@/hooks/useCouponSales";

export function SaleForm({ busy, submitTitle, initialEmail = "", onSubmit }: {
  busy: boolean;
  submitTitle: string;
  initialEmail?: string;
  onSubmit: (sale: SaleInput) => void;
}) {
  const [price, setPrice] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(initialEmail);
  const [error, setError] = React.useState("");

  const submit = () => {
    const salePrice = Number(price.replace(",", "."));
    if (!Number.isFinite(salePrice) || salePrice < 0 || !firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("יש למלא סכום, שם פרטי, שם משפחה וטלפון");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("כתובת האימייל אינה תקינה");
      return;
    }
    setError("");
    onSubmit({ salePrice, buyerFirstName: firstName.trim(), buyerLastName: lastName.trim(), buyerPhone: phone.trim(), buyerEmail: email.trim() || undefined });
  };

  return <View style={styles.form}>
    <Input label="בכמה מכרתי" value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={error} />
    <View style={styles.row}>
      <View style={styles.half}><Input label="שם פרטי" value={firstName} onChangeText={setFirstName} /></View>
      <View style={styles.half}><Input label="שם משפחה" value={lastName} onChangeText={setLastName} /></View>
    </View>
    <Input label="טלפון" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    <Input label="אימייל (רשות)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
    <Button title={submitTitle} onPress={submit} loading={busy} disabled={busy} />
  </View>;
}

const styles = StyleSheet.create({ form: { gap: 10 }, row: { flexDirection: "row-reverse", gap: 10 }, half: { flex: 1 } });
