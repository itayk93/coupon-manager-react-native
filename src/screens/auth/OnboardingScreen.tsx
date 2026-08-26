import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Check, ChevronRight, Sparkles } from "lucide-react-native";
import { useParseCoupon, type ParsedCoupon } from "@/hooks/useCouponAI";
import { saveOnboardingCouponDrafts } from "@/lib/couponDraft";
import { notify } from "@/lib/notify";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fonts, palette, radii } from "@/lib/theme";
import { setOnboardingCompleted } from "@/lib/onboardingStatus";

type Mode = "profile" | "describe" | "preview";

function localCouponFallback(text: string): ParsedCoupon[] {
  const code = text.match(/(?:קוד(?:\s+קופון)?\s*[:\-]?\s*)([A-Z0-9-]{4,})/i)?.[1] || text.match(/\b(?=[A-Z0-9-]{6,}\b)(?=.*\d)[A-Z0-9-]+\b/i)?.[0];
  const value = text.match(/(?:שווה|שווי|ערך)\s*(?:של)?\s*(\d+(?:\.\d+)?)/)?.[1];
  const cost = text.match(/(?:עלה|שילמתי|קניתי ב)\s*(\d+(?:\.\d+)?)/)?.[1];
  const company = text.match(/(?:של|בחברת|לחברת|ב)(?:\s+)([\p{L}][\p{L}\s]{1,24}?)(?=\s+(?:עם|קוד|שווה|בשווי|עלה|שילמתי)|[,\.\n]|$)/u)?.[1]?.trim();
  if (!code || !value || !company) return [];
  return [{ company, code, value: Number(value), cost: cost ? Number(cost) : null, expiration: null, description: null, cvv: null, card_exp: null }];
}

export function OnboardingScreen() {
  const router = useRouter();
  const { social, pendingVerification } = useLocalSearchParams<{ social?: string; pendingVerification?: string }>();
  const { user, refreshUser } = useAuth();
  const { theme } = useAppTheme();
  const parseCoupon = useParseCoupon();
  const [mode, setMode] = useState<Mode>(social ? "profile" : "describe");
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [text, setText] = useState("");
  const [coupons, setCoupons] = useState<ParsedCoupon[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  const step = mode === "profile" ? 1 : mode === "describe" ? 2 : 3;
  const title = mode === "profile" ? "איך לקרוא לך?" : mode === "describe" ? "ספרו לנו על הקופון" : coupons.length > 1 ? "מצאנו את הקופונים" : "מצאנו את הקופון";
  const canIdentify = text.trim().length >= 12;
  const validCoupons = useMemo(() => coupons.filter((coupon) => coupon.company?.trim() && coupon.code?.trim() && Number(coupon.value) > 0), [coupons]);

  const finish = () => {
    if (pendingVerification) router.replace({ pathname: "/(auth)/verify-email", params: { email: pendingVerification } });
    else if (user) router.replace("/(tabs)");
    else router.replace("/(auth)/register");
  };

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setProfileLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { first_name: firstName.trim(), last_name: lastName.trim() } });
      if (error) throw error;
      if (user?.email) {
        const { error: profileError } = await supabase.from("users").update({ first_name: firstName.trim(), last_name: lastName.trim() }).eq("email", user.email.toLowerCase());
        if (profileError) throw profileError;
      }
      await refreshUser(); setMode("describe");
    } catch (error: any) { notify.error("לא הצלחנו לשמור את השם", error.message); }
    finally { setProfileLoading(false); }
  };

  const identify = async () => {
    if (!canIdentify) return;
    try {
      const result = await parseCoupon.mutateAsync({ text: text.trim() });
      setCoupons(result); setMode("preview");
    } catch {
      const fallback = localCouponFallback(text);
      if (fallback.length) { setCoupons(fallback); setMode("preview"); notify.success("מצאנו את הפרטים"); }
    }
  };

  const save = async () => {
    if (!validCoupons.length) return;
    await saveOnboardingCouponDrafts(validCoupons.map((coupon) => ({
      company: coupon.company?.trim() || "", code: coupon.code?.trim() || "", value: String(coupon.value ?? 0), cost: String(coupon.cost ?? 0),
      expiration: coupon.expiration?.slice(0, 10) || "", description: coupon.description?.trim() || "", cvv: coupon.cvv?.trim() || "", cardExp: coupon.card_exp?.trim() || "",
      redemptionUrl: "", includeCardInfo: Boolean(coupon.cvv || coupon.card_exp), origin: "onboarding", createdAt: new Date().toISOString(),
    })));
    await setOnboardingCompleted(user?.email || pendingVerification);
    finish();
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={() => mode === "preview" ? setMode("describe") : router.back()} style={styles.iconButton} accessibilityLabel="חזרה"><ChevronRight size={24} color={theme.text} /></Pressable>
          <View style={styles.progress} accessibilityLabel={`שלב ${step} מתוך 3`}>{[1, 2, 3].map((item) => <View key={item} style={[styles.progressDot, { backgroundColor: item <= step ? theme.primary : theme.border }]} />)}</View>
          <Pressable onPress={finish} style={styles.skipButton}><Text style={styles.skipText}>אפשר לדלג, הקופונים יחכו לך</Text></Pressable>
        </View>

        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{mode === "profile" ? "שם פרטי ומשפחה, כדי שנכיר" : mode === "describe" ? "כותבים חופשי. אנחנו כבר נסדר את הפרטים" : "בדיקה קטנה לפני שמכניסים לארנק"}</Text>
        </Animated.View>

        {mode === "profile" ? <View style={styles.panel}>
          <View style={styles.profileVisual}><CharacterScene state="talking" reduceMotion={reduceMotion} /></View>
          <Field label="שם פרטי" value={firstName} onChangeText={setFirstName} placeholder="למשל נועה" />
          <Field label="שם משפחה" value={lastName} onChangeText={setLastName} placeholder="למשל כהן" />
          <PrimaryButton label="נעים להכיר, ממשיכים" onPress={saveProfile} disabled={profileLoading || !firstName.trim() || !lastName.trim()} loading={profileLoading} />
        </View> : mode === "describe" ? <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260)} style={styles.panel}>
          <View style={styles.talkVisual}>
            <CharacterScene state={parseCoupon.isPending ? "scanning" : "talking"} reduceMotion={reduceMotion} />
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(120)} style={styles.speechBubble}><Text style={styles.speechText}>כתבו לי איזו חברה, מה הקוד, כמה שילמתם וכמה הקופון שווה. יש כמה? כתבו את כולם יחד.</Text></Animated.View>
          </View>
          <TextInput multiline value={text} onChangeText={setText} placeholder={'למשל: יש לי קופון ל־Wolt, קוד WOLT123, שילמתי 70 ₪ והוא שווה 100 ₪'} placeholderTextColor={theme.textSubtle} style={[styles.textArea, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} accessibilityLabel="תיאור הקופונים" />
          <PrimaryButton label={parseCoupon.isPending ? "רגע, מסדרים את הקופונים..." : "למצוא את הקופונים שלי"} onPress={identify} disabled={!canIdentify || parseCoupon.isPending} loading={parseCoupon.isPending} />
        </Animated.View> : <View style={styles.panel}>
          <View style={styles.successVisual}><CharacterScene state="success" reduceMotion={reduceMotion} /></View>
          {coupons.map((coupon, index) => <CouponSummary key={`${coupon.code}-${index}`} coupon={coupon} />)}
          {validCoupons.length !== coupons.length ? <Text style={styles.missingText}>חסר פרט באחד הקופונים. חזרו לטקסט והוסיפו חברה, קוד ושווי.</Text> : null}
          <PrimaryButton label={validCoupons.length > 1 ? `להכניס ${validCoupons.length} קופונים לארנק` : "להכניס לארנק"} onPress={save} disabled={!validCoupons.length || validCoupons.length !== coupons.length} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function CouponSummary({ coupon }: { coupon: ParsedCoupon }) {
  return <View style={styles.couponSummary}><View style={styles.check}><Check size={18} color="#fff" /></View><View style={styles.summaryCopy}><Text style={styles.company}>{coupon.company || "חברה לא זוהתה"}</Text><Text style={styles.details}>קוד {coupon.code || "חסר"} · שווי {coupon.value ?? "חסר"} ₪{coupon.cost != null ? ` · עלה ${coupon.cost} ₪` : ""}</Text></View></View>;
}
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} placeholderTextColor="#8993A4" style={styles.fieldInput} /></View>; }
function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryButtonDisabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color="#fff" /> : <><Sparkles size={19} color="#fff" /><Text style={styles.primaryButtonText}>{label}</Text></>}</Pressable>; }

function CharacterScene({ state, reduceMotion }: { state: "talking" | "scanning" | "success"; reduceMotion: boolean }) {
  const blueY = useSharedValue(0); const blueRotation = useSharedValue(0); const mintY = useSharedValue(0); const mintScale = useSharedValue(1); const baseScale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { blueY.value = 0; blueRotation.value = 0; mintY.value = 0; mintScale.value = 1; baseScale.value = 1; return; }
    if (state === "success") { blueY.value = withSequence(withSpring(-12), withSpring(0)); mintY.value = withSequence(withSpring(-22), withSpring(0), withSpring(-8), withSpring(0)); baseScale.value = withSequence(withSpring(1.06), withSpring(1)); return; }
    const duration = state === "scanning" ? 480 : 720;
    blueY.value = withRepeat(withSequence(withTiming(-5, { duration }), withTiming(2, { duration })), -1, true);
    blueRotation.value = withRepeat(withSequence(withTiming(-3, { duration }), withTiming(2, { duration })), -1, true);
    mintY.value = withRepeat(withSequence(withTiming(-8, { duration: duration + 80 }), withTiming(1, { duration: duration + 80 })), -1, true);
    mintScale.value = withRepeat(withSequence(withTiming(1.035, { duration: 260, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 260 })), -1, true);
  }, [baseScale, blueRotation, blueY, mintScale, mintY, reduceMotion, state]);
  const blueStyle = useAnimatedStyle(() => ({ transform: [{ translateY: blueY.value }, { rotate: `${blueRotation.value}deg` }] }));
  const mintStyle = useAnimatedStyle(() => ({ transform: [{ translateY: mintY.value }, { scale: mintScale.value }] }));
  const baseStyle = useAnimatedStyle(() => ({ transform: [{ scale: baseScale.value }] }));
  const success = state === "success";
  return <View style={styles.characterScene}><Animated.Image source={success ? require("../../../assets/onboarding/coupon-saved.png") : require("../../../assets/onboarding/ai-scan-coupon.png")} style={[styles.sceneBase, baseStyle]} resizeMode="contain" /><Animated.Image source={require("../../../assets/onboarding/blue-investigator-cutout.png")} style={[styles.sceneCharacter, styles.sceneBlue, blueStyle]} resizeMode="contain" /><Animated.Image source={require("../../../assets/onboarding/mint-helper-cutout.png")} style={[styles.sceneCharacter, styles.sceneMint, mintStyle]} resizeMode="contain" /></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1 }, content: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  topRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skipButton: { maxWidth: 150, minHeight: 44, justifyContent: "center" }, skipText: { color: palette.primary, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17, textAlign: "left", writingDirection: "rtl" },
  progress: { flexDirection: "row", gap: 7, transform: [{ scaleX: -1 }] }, progressDot: { width: 24, height: 5, borderRadius: 3 },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "800", textAlign: "center", writingDirection: "rtl", marginTop: 18 }, subtitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: "center", writingDirection: "rtl", marginTop: 8, marginBottom: 22 },
  panel: { gap: 16, padding: 18, borderRadius: radii.card, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDE4EF" }, profileVisual: { height: 170, overflow: "hidden" }, talkVisual: { height: 250, position: "relative", overflow: "hidden", borderRadius: 12, backgroundColor: "#F7F9FC" }, successVisual: { height: 170, overflow: "hidden" },
  speechBubble: { position: "absolute", top: 12, right: 12, maxWidth: "68%", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#CFE0FF", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }, speechText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 19, color: "#263246", textAlign: "right", writingDirection: "rtl" },
  textArea: { minHeight: 150, maxHeight: 230, borderWidth: 1, borderRadius: 12, padding: 14, textAlign: "right", writingDirection: "rtl", textAlignVertical: "top", fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  field: { gap: 6 }, fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#263246", textAlign: "right", writingDirection: "rtl" }, fieldInput: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: "#CAD6E8", backgroundColor: "#F9FBFD", paddingHorizontal: 14, color: "#172033", textAlign: "right", writingDirection: "rtl", fontFamily: fonts.body, fontSize: 15 },
  primaryButton: { minHeight: 54, borderRadius: 12, backgroundColor: palette.primary, flexDirection: "row-reverse", gap: 8, alignItems: "center", justifyContent: "center" }, primaryButtonDisabled: { opacity: 0.42 }, primaryButtonText: { fontFamily: fonts.bodyBold, color: "#fff", fontSize: 16 }, pressed: { opacity: 0.82 },
  couponSummary: { minHeight: 76, padding: 14, borderRadius: 10, backgroundColor: "#F5F8FF", flexDirection: "row-reverse", gap: 12, alignItems: "center", borderWidth: 1, borderColor: "#DCE7FA" }, check: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#28A071", alignItems: "center", justifyContent: "center" }, summaryCopy: { flex: 1 }, company: { fontFamily: fonts.bodyBold, fontSize: 17, color: "#172033", textAlign: "right", writingDirection: "rtl" }, details: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl", marginTop: 2 }, missingText: { fontFamily: fonts.bodyBold, color: "#B54708", textAlign: "right", writingDirection: "rtl" },
  characterScene: { width: "100%", height: "100%", position: "relative", overflow: "hidden" }, sceneBase: { position: "absolute", width: "68%", height: "90%", left: "16%", top: "5%" }, sceneCharacter: { position: "absolute", width: "32%", height: "58%", bottom: "1%" }, sceneBlue: { left: "0%" }, sceneMint: { right: "0%" },
});
