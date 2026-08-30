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
import {
  CheckCircle,
  ChevronLeft,
  Clock,
  ClipboardList,
  FileText,
  Gift,
  Link2,
  Rocket,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { CharacterSpotlight } from "@/components/onboarding/CharacterRig";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMyReferralStatus } from "@/hooks/useReferral";
import { useMyApplication, useSubmitApplication } from "@/hooks/useReferralApplication";
import { fonts, radii, shadows } from "@/lib/theme";

const REWARDS = [
  { target: 10, metric: "מופעלים", prize: "קופון ₪ 50", icon: Gift, color: "#3b82f6" },
  { target: 25, metric: "מופעלים", prize: "קופון ₪ 50", icon: Star, color: "#8b5cf6" },
  { target: 25, metric: "שנשארו", prize: "₪ 100 בביט", icon: TrendingUp, color: "#10b981" },
];

const STEPS = [
  { n: 1, label: "הגישו בקשה", Icon: ClipboardList },
  { n: 2, label: "קבלו קישור", Icon: Link2 },
  { n: 3, label: "הרוויחו", Icon: Rocket },
];

export function ReferralProgramScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { session } = useAuth();
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

        {/* ── Hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroGradient}>
            <CharacterSpotlight character="investigator" state="talking" size="medium" tone="none" />
            <Text style={styles.heroTitle}>הזמינו חברים.{"\n"}קבלו פרסים.</Text>
            <Text style={styles.heroTag}>תוכנית השותפים של קופון מאסטר</Text>
          </View>
        </View>

        {/* ── Steps ── */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>3 צעדים פשוטים</Text>
        <View style={styles.stepsRow}>
          {STEPS.map((step, i) => (
            <React.Fragment key={step.n}>
              {i > 0 && <View style={[styles.stepLine, { backgroundColor: theme.border }]} />}
              <View style={styles.stepBubble}>
                <View style={[styles.stepCircle, { backgroundColor: theme.primary }]}>
                  <step.Icon size={22} color="#fff" strokeWidth={2} />
                </View>
                <Text style={[styles.stepNum, { color: theme.primary }]}>{step.n}</Text>
                <Text style={[styles.stepLabel, { color: theme.text }]}>{step.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* ── Rewards ── */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>מה מרוויחים?</Text>
        <View style={styles.rewardsStack}>
          {REWARDS.map((r, i) => (
            <View key={i} style={[styles.rewardCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={[styles.rewardBadge, { backgroundColor: r.color }]}>
                <r.icon size={22} color="#fff" strokeWidth={2} />
              </View>
              <View style={styles.rewardBody}>
                <Text style={[styles.rewardTarget, { color: theme.text }]}>
                  {r.target} משתמשים {r.metric}
                </Text>
                <Text style={[styles.rewardPrize, { color: r.color }]}>{r.prize}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── How it counts ── */}
        <View style={[styles.infoCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
          <Zap size={18} color="#3b82f6" />
          <View style={styles.infoBody}>
            <Text style={[styles.infoTitle, { color: "#1e40af" }]}>איך סופרים?</Text>
            <Text style={[styles.infoText, { color: "#1e40af" }]}>
              <Text style={styles.bold}>הפעלה</Text> = המשתמש הוסיף קופון + 3 ימים פעילים תוך 30 יום{"\n"}
              <Text style={styles.bold}>שימור</Text> = 2 ימים פעילים נוספים בימים 31–60{"\n"}
              הפניות עקיפות נספרות גם — שותף שהבאתם מזמין אנשים? נספר גם לכם.
            </Text>
          </View>
        </View>

        {/* ── Status / Form ── */}
        {(loadingStatus || loadingApp) ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
        ) : isPartner ? (
          <StatusBanner
            bg="#dcfce7" border="#86efac" color="#16a34a"
            icon={<CheckCircle size={22} color="#16a34a" />}
            text="את/ה כבר שותף/ה! עברו למסך ההזמנות כדי לשתף."
          />
        ) : wasApproved ? (
          <StatusBanner
            bg="#dcfce7" border="#86efac" color="#16a34a"
            icon={<CheckCircle size={22} color="#16a34a" />}
            text="הבקשה אושרה! ניצור איתכם קשר בקרוב."
          />
        ) : hasPending ? (
          <StatusBanner
            bg="#fef9c3" border="#fde047" color="#ca8a04"
            icon={<Clock size={22} color="#ca8a04" />}
            text="הבקשה התקבלה וממתינה לאישור. ניצור איתכם קשר בהקדם."
          />
        ) : (
          <>
            {wasRejected ? (
              <StatusBanner
                bg="#fee2e2" border="#fca5a5" color="#dc2626"
                icon={<XCircle size={22} color="#dc2626" />}
                text={`הבקשה הקודמת לא אושרה.${application?.review_note ? ` (${application.review_note})` : ""} ניתן להגיש שוב.`}
              />
            ) : null}

            <View style={styles.formSection}>
              <View style={styles.formTitleRow}>
                <CharacterSpotlight character="helper" state="cheering" size="small" tone="mint" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>רוצים להצטרף?</Text>
                  <Text style={[styles.formSubtitle, { color: theme.textMuted }]}>מלאו את הפרטים ונחזור אליכם</Text>
                </View>
              </View>

              {!session ? (
                <View style={[styles.loginCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.loginNote, { color: theme.textMuted }]}>
                    יש להתחבר כדי להגיש בקשה
                  </Text>
                </View>
              ) : (
                <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <FormField label="שם מלא *" value={fullName} onChange={setFullName} placeholder="איך קוראים לכם?" theme={theme} />
                  <FormField label="אימייל *" value={email} onChange={setEmail} placeholder="your@email.com" theme={theme} keyboardType="email-address" />
                  <FormField label="טלפון" value={phone} onChange={setPhone} placeholder="אופציונלי" theme={theme} keyboardType="phone-pad" />
                  <FormField label="למה אתם רוצים להצטרף?" value={reason} onChange={setReason} placeholder="ספרו לנו קצת..." theme={theme} multiline />

                  <TouchableOpacity
                    style={[styles.submitBtn, { opacity: submit.isPending ? 0.6 : 1 }]}
                    onPress={() => submit.mutate({ fullName, email, phone, reason })}
                    disabled={submit.isPending || !fullName.trim() || !email.trim()}
                    activeOpacity={0.8}
                  >
                    {submit.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>שליחת בקשה</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Legal terms link ── */}
        <TouchableOpacity
          style={[styles.termsLink, { borderColor: theme.border }]}
          onPress={() => router.push("/referral-terms")}
          activeOpacity={0.7}
        >
          <FileText size={16} color={theme.textMuted} />
          <Text style={[styles.termsLinkText, { color: theme.textMuted }]}>תנאי התחרות המלאים</Text>
          <ChevronLeft size={14} color={theme.textMuted} />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Sub-components ─── */

function StatusBanner({ bg, border, color, icon, text }: { bg: string; border: string; color: string; icon: React.ReactNode; text: string }) {
  return (
    <View style={[styles.statusCard, { backgroundColor: bg, borderColor: border }]}>
      {icon}
      <Text style={[styles.statusText, { color }]}>{text}</Text>
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

/* ─── Styles ─── */

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 20 },

  heroCard: { borderRadius: 20, overflow: "hidden" },
  heroGradient: {
    backgroundColor: "#1d4ed8",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontWeight: "800",
    fontSize: 28,
    color: "#fff",
    textAlign: "center",
    lineHeight: 38,
  },
  heroTag: {
    fontFamily: fonts.body,
    fontWeight: "400",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    overflow: "hidden",
  },

  sectionTitle: {
    fontFamily: fonts.displaySemi,
    fontWeight: "700",
    fontSize: 20,
    textAlign: "right",
    marginTop: 4,
  },

  stepsRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 0,
  },
  stepBubble: { alignItems: "center", width: 80, gap: 4 },
  stepCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontFamily: fonts.display, fontWeight: "800", fontSize: 13 },
  stepLabel: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 11, textAlign: "center" },
  stepLine: { height: 2, flex: 1, marginTop: 26, borderRadius: 1 },

  rewardsStack: { gap: 10 },
  rewardCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.card,
  },
  rewardBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardBody: { flex: 1, gap: 2 },
  rewardTarget: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 14, textAlign: "right" },
  rewardPrize: { fontFamily: fonts.display, fontWeight: "800", fontSize: 16, textAlign: "right" },

  bold: { fontFamily: fonts.bodyBold, fontWeight: "700" },

  infoCard: {
    flexDirection: "row-reverse",
    gap: 10,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  infoBody: { flex: 1, gap: 4 },
  infoTitle: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 14, textAlign: "right" },
  infoText: { fontFamily: fonts.body, fontWeight: "400", fontSize: 12, textAlign: "right", lineHeight: 20 },

  statusCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  statusText: { fontFamily: fonts.body, fontWeight: "400", fontSize: 14, flex: 1, textAlign: "right" },

  formSection: { gap: 12 },
  formTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  formSubtitle: { fontFamily: fonts.body, fontWeight: "400", fontSize: 13, textAlign: "right" },
  formCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
    ...shadows.card,
  },
  loginCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
  },
  loginNote: { fontFamily: fonts.body, fontWeight: "400", fontSize: 14, textAlign: "center" },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: fonts.bodyBold, fontWeight: "700", fontSize: 13, textAlign: "right" },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontWeight: "400",
    fontSize: 14,
    textAlign: "right",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },

  submitBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { fontFamily: fonts.display, fontWeight: "800", fontSize: 17, color: "#fff" },

  termsLink: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  termsLinkText: { fontFamily: fonts.body, fontWeight: "400", fontSize: 13 },
});
