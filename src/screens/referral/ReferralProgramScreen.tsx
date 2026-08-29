import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CheckCircle, Clock, Gift, TrendingUp, Users, XCircle } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMyReferralStatus } from "@/hooks/useReferral";
import { useMyApplication, useSubmitApplication } from "@/hooks/useReferralApplication";
import { fonts, radii, shadows } from "@/lib/theme";

export function ReferralProgramScreen() {
  const { theme } = useAppTheme();
  const { session, user } = useAuth();
  const { data: referralStatus, isLoading: loadingStatus } = useMyReferralStatus();
  const { data: application, isLoading: loadingApp } = useMyApplication();
  const submit = useSubmitApplication();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const isPartner = Boolean(referralStatus?.code);
  const hasPending = application?.status === "pending";
  const wasRejected = application?.status === "rejected";
  const wasApproved = application?.status === "approved";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="תוכנית השותפים" showBack />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroTitle}>הרוויחו מהפניות לקופון מאסטר</Text>
          <Text style={styles.heroSub}>
            הזמינו חברים, עקבו אחרי ההתקדמות, וקבלו תגמולים אמיתיים
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>איך זה עובד?</Text>

        <View style={styles.stepsContainer}>
          <StepCard
            icon={<Users size={24} color={theme.primary} />}
            title="הגישו בקשה"
            description="מלאו את הטופס למטה ונחזור אליכם"
            theme={theme}
          />
          <StepCard
            icon={<Gift size={24} color={theme.primary} />}
            title="קבלו קישור אישי"
            description="לאחר אישור תקבלו קישור ייחודי לשיתוף"
            theme={theme}
          />
          <StepCard
            icon={<TrendingUp size={24} color={theme.primary} />}
            title="הזמינו והרוויחו"
            description="כל חבר שנרשם ומשתמש באפליקציה מקדם אתכם לפרסים"
            theme={theme}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>תנאי התוכנית</Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TermRow label="שלב 1 — הפעלה" value="המשתמש מוסיף קופון + 3 ימים פעילים תוך 30 יום" theme={theme} />
          <TermRow label="שלב 2 — שימור" value="2 ימים פעילים נוספים בימים 31–60" theme={theme} />
          <Text style={[styles.termNote, { color: theme.textMuted }]}>
            משתמש ״שנשאר״ = עבר גם הפעלה וגם שימור. כלומר הוא פעיל באמת ולא רק נרשם.
          </Text>
          <View style={styles.divider} />
          <TermRow label="10 משתמשים מופעלים" value="קופון 50₪" theme={theme} highlight />
          <TermRow label="25 משתמשים מופעלים" value="קופון 50₪" theme={theme} highlight />
          <TermRow label="25 משתמשים שנשארו" value="100₪ במזומן" theme={theme} highlight />
          <View style={styles.divider} />
          <Text style={[styles.termNote, { color: theme.textMuted }]}>
            הפניות עקיפות נספרות גם — אם מישהו שהזמנתם הופך שותף בעצמו, המשתמשים שלו נספרים גם לכם.
          </Text>
        </View>

        {(loadingStatus || loadingApp) ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
        ) : isPartner ? (
          <View style={[styles.statusCard, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
            <CheckCircle size={24} color="#16a34a" />
            <Text style={[styles.statusText, { color: "#16a34a" }]}>
              את/ה כבר שותף/ה פעיל/ה! עברו למסך ההזמנות כדי לשתף את הקישור שלכם.
            </Text>
          </View>
        ) : wasApproved ? (
          <View style={[styles.statusCard, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
            <CheckCircle size={24} color="#16a34a" />
            <Text style={[styles.statusText, { color: "#16a34a" }]}>
              הבקשה אושרה! ניצור איתכם קשר בקרוב.
            </Text>
          </View>
        ) : hasPending ? (
          <View style={[styles.statusCard, { backgroundColor: "#fef9c3", borderColor: "#fde047" }]}>
            <Clock size={24} color="#ca8a04" />
            <Text style={[styles.statusText, { color: "#ca8a04" }]}>
              הבקשה שלכם התקבלה וממתינה לאישור. ניצור איתכם קשר בהקדם.
            </Text>
          </View>
        ) : (
          <>
            {wasRejected ? (
              <View style={[styles.statusCard, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
                <XCircle size={24} color="#dc2626" />
                <Text style={[styles.statusText, { color: "#dc2626" }]}>
                  הבקשה הקודמת לא אושרה.{application?.review_note ? ` (${application.review_note})` : ""} ניתן להגיש שוב.
                </Text>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: theme.text }]}>הגשת בקשה</Text>

            {!session ? (
              <Text style={[styles.loginNote, { color: theme.textMuted }]}>
                יש להתחבר כדי להגיש בקשה
              </Text>
            ) : (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <FormField
                  label="שם מלא *"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="השם שיופיע בעמוד השותפים"
                  theme={theme}
                />
                <FormField
                  label="אימייל *"
                  value={email}
                  onChange={setEmail}
                  placeholder="כתובת אימייל ליצירת קשר"
                  theme={theme}
                  keyboardType="email-address"
                />
                <FormField
                  label="טלפון"
                  value={phone}
                  onChange={setPhone}
                  placeholder="אופציונלי"
                  theme={theme}
                  keyboardType="phone-pad"
                />
                <FormField
                  label="למה אתם רוצים להצטרף?"
                  value={reason}
                  onChange={setReason}
                  placeholder="ספרו לנו קצת על עצמכם..."
                  theme={theme}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: submit.isPending ? 0.6 : 1 }]}
                  onPress={() => submit.mutate({ fullName, email, phone, reason })}
                  disabled={submit.isPending || !fullName.trim() || !email.trim()}
                >
                  {submit.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>שליחת בקשה</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StepCard({ icon, title, description, theme }: { icon: React.ReactNode; title: string; description: string; theme: any }) {
  return (
    <View style={[styles.stepCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {icon}
      <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.stepDesc, { color: theme.textMuted }]}>{description}</Text>
    </View>
  );
}

function TermRow({ label, value, theme, highlight }: { label: string; value: string; theme: any; highlight?: boolean }) {
  return (
    <View style={styles.termRow}>
      <Text style={[styles.termLabel, { color: highlight ? theme.primary : theme.text }]}>{label}</Text>
      <Text style={[styles.termValue, { color: theme.textMuted }]}>{value}</Text>
    </View>
  );
}

function FormField({ label, value, onChange, placeholder, theme, keyboardType, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; theme: any;
  keyboardType?: string; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType as any}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 16 },
  heroCard: { borderRadius: radii.lg, padding: 24, gap: 8, alignItems: "center" },
  heroTitle: { fontFamily: fonts.display, fontSize: 22, color: "#fff", textAlign: "center" },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 18, textAlign: "right", marginTop: 8 },
  stepsContainer: { gap: 10 },
  stepCard: {
    borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6,
    alignItems: "center", ...shadows.card,
  },
  stepTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  stepDesc: { fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
  card: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10, ...shadows.card },
  termRow: { gap: 2 },
  termLabel: { fontFamily: fonts.bodyBold, fontSize: 14, textAlign: "right" },
  termValue: { fontFamily: fonts.body, fontSize: 13, textAlign: "right" },
  termNote: { fontFamily: fonts.body, fontSize: 12, textAlign: "right", lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#e2e8f0", marginVertical: 4 },
  statusCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    borderRadius: radii.md, borderWidth: 1, padding: 16,
  },
  statusText: { fontFamily: fonts.body, fontSize: 14, flex: 1, textAlign: "right" },
  loginNote: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: 8 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "right" },
  input: {
    borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, textAlign: "right",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  submitBtn: { borderRadius: radii.md, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#fff" },
});
