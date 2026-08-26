import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AlarmClock, Check, ChevronRight, Search, Sparkles, TrendingUp } from "lucide-react-native";
import { useParseCoupon, type ParsedCoupon } from "@/hooks/useCouponAI";
import { saveOnboardingCouponDrafts } from "@/lib/couponDraft";
import { notify } from "@/lib/notify";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fonts, palette, radii } from "@/lib/theme";
import { setOnboardingCompleted } from "@/lib/onboardingStatus";
import { estimateAnnualSavings, saveOnboardingPrefs, type OnboardingGoal, type OnboardingVolume } from "@/lib/onboardingPrefs";
import { Confetti, CountUp } from "@/components/onboarding/Celebration";
import { CharacterScene, type CharacterState } from "@/components/onboarding/CharacterRig";
import { logActivity } from "@/lib/activityLog";

type Mode = "profile" | "goal" | "volume" | "describe" | "preview";

const GOALS: { id: OnboardingGoal; label: string; hint: string; icon: typeof AlarmClock; reply: string }[] = [
  { id: "expiry", label: "שוכח שהם פגים", hint: "התוקף עובר וזה מרגיז", icon: AlarmClock, reply: "זה בדיוק מה שאני מונע. אזכיר לך לפני שכל קופון פג." },
  { id: "lost", label: "מאבד את הקודים", hint: "הם קבורים באיזה צ׳אט", icon: Search, reply: "מעכשיו הכל במקום אחד, וגם חיפוש מהיר." },
  { id: "sell", label: "לא מספיק למכור", hint: "נשארים בלי שימוש", icon: TrendingUp, reply: "נסמן לך מה כדאי למכור, בזמן שהוא עוד שווה משהו." },
];

const VOLUMES: { id: OnboardingVolume; label: string; hint: string }[] = [
  { id: "few", label: "אחד־שניים", hint: "מדי פעם נופל לי קופון" },
  { id: "some", label: "כמה בחודש", hint: "יש תנועה יפה" },
  { id: "many", label: "המון", hint: "אני חי על זה" },
];

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
  const identity = user?.email || pendingVerification;
  const [mode, setMode] = useState<Mode>(social ? "profile" : "goal");
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [text, setText] = useState("");
  const [coupons, setCoupons] = useState<ParsedCoupon[]>([]);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [volume, setVolume] = useState<OnboardingVolume | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Haptics are a nicety, and a device without a taptic engine rejects them.
  // Nothing in the flow should ever fail because a buzz did not happen.
  const tap = useCallback((style: "select" | "success" = "select") => {
    if (reduceMotion) return;
    if (style === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else void Haptics.selectionAsync().catch(() => {});
  }, [reduceMotion]);

  // The name step only exists for social sign-ups, so the progress bar counts
  // the steps this particular user is actually going to walk through.
  const steps: Mode[] = useMemo(() => (social ? ["profile", "goal", "volume", "describe", "preview"] : ["goal", "volume", "describe", "preview"]), [social]);
  const step = steps.indexOf(mode) + 1;

  const goalChoice = GOALS.find((item) => item.id === goal);
  const title = mode === "profile" ? "איך לקרוא לך?"
    : mode === "goal" ? "מה הכי מציק לך בקופונים?"
    : mode === "volume" ? "כמה קופונים עוברים דרכך?"
    : mode === "describe" ? "ספרו לנו על הקופון"
    : coupons.length > 1 ? "מצאנו את הקופונים" : "מצאנו את הקופון";
  const subtitle = mode === "profile" ? "שם פרטי ומשפחה, כדי שנכיר"
    : mode === "goal" ? "בוחרים אחד, ואני אתפור את הארנק סביבו"
    : mode === "volume" ? "רק כדי לדעת כמה עבודה מחכה לי"
    : mode === "describe" ? "כותבים חופשי. אנחנו כבר נסדר את הפרטים"
    : "בדיקה קטנה לפני שמכניסים לארנק";

  const canIdentify = text.trim().length >= 12;
  const validCoupons = useMemo(() => coupons.filter((coupon) => coupon.company?.trim() && coupon.code?.trim() && Number(coupon.value) > 0), [coupons]);
  const savedNow = useMemo(() => validCoupons.reduce((total, coupon) => total + Math.max(0, Number(coupon.value ?? 0) - Number(coupon.cost ?? 0)), 0), [validCoupons]);
  const annualSavings = useMemo(() => estimateAnnualSavings(volume || undefined, savedNow / Math.max(1, validCoupons.length)), [savedNow, validCoupons.length, volume]);

  const back = () => {
    const index = steps.indexOf(mode);
    if (index > 0) setMode(steps[index - 1]);
    else router.back();
  };

  const finish = () => {
    if (pendingVerification) router.replace({ pathname: "/(auth)/verify-email", params: { email: pendingVerification } });
    else if (user) router.replace("/(tabs)");
    else router.replace("/(auth)/register");
  };

  const chooseGoal = (id: OnboardingGoal) => {
    tap();
    setGoal(id);
    void saveOnboardingPrefs(identity, { goal: id });
    // A beat before advancing, so the character's reply is actually read.
    setTimeout(() => setMode("volume"), reduceMotion ? 0 : 900);
  };

  const chooseVolume = (id: OnboardingVolume) => {
    tap();
    setVolume(id);
    void saveOnboardingPrefs(identity, { volume: id });
    setTimeout(() => setMode("describe"), reduceMotion ? 0 : 700);
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
      await refreshUser(); tap(); setMode("goal");
    } catch (error: any) { notify.error("לא הצלחנו לשמור את השם", error.message); }
    finally { setProfileLoading(false); }
  };

  const identify = async () => {
    if (!canIdentify) return;
    try {
      const result = await parseCoupon.mutateAsync({ text: text.trim() });
      setCoupons(result); setMode("preview"); tap("success");
    } catch {
      const fallback = localCouponFallback(text);
      if (fallback.length) { setCoupons(fallback); setMode("preview"); tap("success"); notify.success("מצאנו את הפרטים"); }
    }
  };

  const save = async () => {
    if (!validCoupons.length) return;
    tap("success");
    await saveOnboardingCouponDrafts(validCoupons.map((coupon) => ({
      company: coupon.company?.trim() || "", code: coupon.code?.trim() || "", value: String(coupon.value ?? 0), cost: String(coupon.cost ?? 0),
      expiration: coupon.expiration?.slice(0, 10) || "", description: coupon.description?.trim() || "", cvv: coupon.cvv?.trim() || "", cardExp: coupon.card_exp?.trim() || "",
      redemptionUrl: "", includeCardInfo: Boolean(coupon.cvv || coupon.card_exp), origin: "onboarding", createdAt: new Date().toISOString(),
    })));
    await setOnboardingCompleted(identity);
    logActivity("onboarding_complete");
    finish();
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={back} style={styles.iconButton} accessibilityLabel="חזרה"><ChevronRight size={24} color={theme.text} /></Pressable>
          <ProgressBar step={step} total={steps.length} reduceMotion={reduceMotion} trackColor={theme.border} />
          <Pressable onPress={finish} style={styles.skipButton}><Text style={styles.skipText}>אפשר לדלג, הקופונים יחכו לך</Text></Pressable>
        </View>

        <Animated.View key={mode} entering={reduceMotion ? undefined : FadeIn.duration(220)}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        </Animated.View>

        {mode === "profile" ? <View style={styles.panel}>
          <View style={styles.profileVisual}><CharacterScene state="talking" reduceMotion={reduceMotion} compact /></View>
          <Field label="שם פרטי" value={firstName} onChangeText={setFirstName} placeholder="למשל נועה" />
          <Field label="שם משפחה" value={lastName} onChangeText={setLastName} placeholder="למשל כהן" />
          <PrimaryButton label="נעים להכיר, ממשיכים" onPress={saveProfile} disabled={profileLoading || !firstName.trim() || !lastName.trim()} loading={profileLoading} />
        </View>

        : mode === "goal" ? <View style={styles.panel}>
          <View style={styles.talkVisual}>
            <CharacterScene state={goal ? "cheering" : "thinking"} reduceMotion={reduceMotion} />
            <SpeechBubble reduceMotion={reduceMotion} text={goalChoice ? goalChoice.reply : "תגידו לי מה כואב, ואני אדע איפה להתחיל."} />
          </View>
          {GOALS.map((option, index) => <ChoiceCard key={option.id} index={index} reduceMotion={reduceMotion} selected={goal === option.id} label={option.label} hint={option.hint} Icon={option.icon} onPress={() => chooseGoal(option.id)} />)}
        </View>

        : mode === "volume" ? <View style={styles.panel}>
          <View style={styles.talkVisual}>
            <CharacterScene state={volume ? "cheering" : "thinking"} reduceMotion={reduceMotion} />
            <SpeechBubble reduceMotion={reduceMotion} text={volume ? "מצוין. בונה לך ארנק בדיוק בגודל הזה." : "אין תשובה נכונה. רק שאדע כמה מקום להכין."} />
          </View>
          {VOLUMES.map((option, index) => <ChoiceCard key={option.id} index={index} reduceMotion={reduceMotion} selected={volume === option.id} label={option.label} hint={option.hint} onPress={() => chooseVolume(option.id)} />)}
        </View>

        : mode === "describe" ? <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260)} style={styles.panel}>
          <View style={styles.talkVisual}>
            <CharacterScene state={parseCoupon.isPending ? "scanning" : "talking"} reduceMotion={reduceMotion} />
            <SpeechBubble reduceMotion={reduceMotion} text="איזו חברה, מה הקוד, כמה שילמתם וכמה הוא שווה. יש כמה? כתבו את כולם." />
          </View>
          <TextInput multiline value={text} onChangeText={setText} placeholder={'למשל: יש לי קופון ל־Wolt, קוד WOLT123, שילמתי 70 ₪ והוא שווה 100 ₪'} placeholderTextColor={theme.textSubtle} style={[styles.textArea, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} accessibilityLabel="תיאור הקופונים" />
          <PrimaryButton label={parseCoupon.isPending ? "רגע, מסדרים את הקופונים..." : "למצוא את הקופונים שלי"} onPress={identify} disabled={!canIdentify || parseCoupon.isPending} loading={parseCoupon.isPending} />
        </Animated.View>

        : <View style={styles.panel}>
          <View style={styles.successVisual}><CharacterScene state="success" reduceMotion={reduceMotion} compact /></View>
          {/* Overlaid on the whole panel rather than on the illustration: the
              illustration clips its overflow, and confetti that stops falling
              120pt in reads as a glitch. */}
          <Confetti active reduceMotion={reduceMotion} />
          {savedNow > 0 ? <View style={styles.savingsBlock} accessibilityLabel={`חסכתם ${Math.round(savedNow)} שקלים`}>
            <Text style={styles.savingsLabel}>חסכתם כאן</Text>
            <CountUp value={Math.round(savedNow)} suffix=" ₪" reduceMotion={reduceMotion} style={styles.savingsValue} />
            <Text style={styles.savingsFoot}>בקצב הזה זה בערך {annualSavings.toLocaleString("he-IL")} ₪ בשנה</Text>
          </View> : null}
          {coupons.map((coupon, index) => <CouponSummary key={`${coupon.code}-${index}`} coupon={coupon} />)}
          {validCoupons.length !== coupons.length ? <Text style={styles.missingText}>חסר פרט באחד הקופונים. חזרו לטקסט והוסיפו חברה, קוד ושווי.</Text> : null}
          <PrimaryButton label={validCoupons.length > 1 ? `להכניס ${validCoupons.length} קופונים לארנק` : "להכניס לארנק"} onPress={save} disabled={!validCoupons.length || validCoupons.length !== coupons.length} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/**
 * A bar that fills, rather than dots that light up.
 *
 * Dots read as "a form with N pages left"; a bar that springs forward on each
 * answer reads as progress the user just made.
 */
function ProgressBar({ step, total, reduceMotion, trackColor }: { step: number; total: number; reduceMotion: boolean; trackColor: string }) {
  const progress = useSharedValue(step / total);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, step / total));
    progress.value = reduceMotion ? target : withSpring(target, { damping: 16, stiffness: 130 });
  }, [progress, reduceMotion, step, total]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={[styles.progressTrack, { backgroundColor: trackColor }]} accessibilityLabel={`שלב ${step} מתוך ${total}`}>
    <Animated.View style={[styles.progressFill, fillStyle]} />
  </View>;
}

function SpeechBubble({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  return <Animated.View key={text} entering={reduceMotion ? undefined : FadeInDown.duration(240)} style={styles.speechBubble}>
    <Text style={styles.speechText}>{text}</Text>
  </Animated.View>;
}

function ChoiceCard({ label, hint, Icon, selected, onPress, index, reduceMotion }: { label: string; hint: string; Icon?: typeof AlarmClock; selected: boolean; onPress: () => void; index: number; reduceMotion: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { scale.value = 1; return; }
    scale.value = selected ? withSequence(withSpring(1.04, { damping: 9 }), withSpring(1)) : withSpring(1);
  }, [reduceMotion, scale, selected]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Two wrappers on purpose: a layout animation and an animated transform on
  // the same view fight over `transform`, and Reanimated warns about it.
  return <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(index * 70).duration(260)}>
    <Animated.View style={style}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.choiceCard, selected && styles.choiceCardSelected, pressed && styles.pressed]}>
      {Icon ? <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}><Icon size={20} color={selected ? "#fff" : palette.primary} /></View> : null}
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      {selected ? <View style={styles.choiceCheck}><Check size={15} color="#fff" /></View> : null}
    </Pressable>
    </Animated.View>
  </Animated.View>;
}

function CouponSummary({ coupon }: { coupon: ParsedCoupon }) {
  return <View style={styles.couponSummary}><View style={styles.check}><Check size={18} color="#fff" /></View><View style={styles.summaryCopy}><Text style={styles.company}>{coupon.company || "חברה לא זוהתה"}</Text><Text style={styles.details}>קוד {coupon.code || "חסר"} · שווי {coupon.value ?? "חסר"} ₪{coupon.cost != null ? ` · עלה ${coupon.cost} ₪` : ""}</Text></View></View>;
}
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} placeholderTextColor="#8993A4" style={styles.fieldInput} /></View>; }
function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryButtonDisabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color="#fff" /> : <><Sparkles size={19} color="#fff" /><Text style={styles.primaryButtonText}>{label}</Text></>}</Pressable>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1 }, content: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  topRow: { minHeight: 62, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skipButton: { maxWidth: 150, minHeight: 44, justifyContent: "center" }, skipText: { color: palette.primary, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 17, textAlign: "left", writingDirection: "rtl" },
  // Mirrored so the fill grows from the right, with the rest of the RTL layout.
  progressTrack: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden", transform: [{ scaleX: -1 }] },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: palette.primary },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: "800", textAlign: "center", writingDirection: "rtl", marginTop: 18 }, subtitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: "center", writingDirection: "rtl", marginTop: 8, marginBottom: 22 },
  panel: { gap: 16, padding: 18, borderRadius: radii.card, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDE4EF" }, profileVisual: { height: 170, overflow: "hidden" }, talkVisual: { height: 250, position: "relative", overflow: "hidden", borderRadius: 12, backgroundColor: "#F7F9FC" }, successVisual: { height: 170, overflow: "hidden" },
  speechBubble: { position: "absolute", top: 12, right: 12, maxWidth: "68%", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#CFE0FF", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }, speechText: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 19, color: "#263246", textAlign: "right", writingDirection: "rtl" },
  choiceCard: { minHeight: 72, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#DDE4EF", backgroundColor: "#FBFCFE", flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  choiceCardSelected: { borderColor: palette.primary, backgroundColor: palette.primaryTint },
  choiceIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1FC" }, choiceIconSelected: { backgroundColor: palette.primary },
  choiceCopy: { flex: 1 }, choiceLabel: { fontFamily: fonts.bodyBold, fontSize: 16.5, color: "#172033", textAlign: "right", writingDirection: "rtl" }, choiceLabelSelected: { color: palette.primaryDark },
  choiceHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  choiceCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  savingsBlock: { alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: palette.successBg },
  savingsLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: palette.successText, textAlign: "center", writingDirection: "rtl" },
  savingsValue: { fontFamily: fonts.display, fontSize: 36, fontWeight: "800", color: palette.successText, textAlign: "center" },
  savingsFoot: { fontFamily: fonts.body, fontSize: 12.5, color: palette.successText, textAlign: "center", writingDirection: "rtl", marginTop: 2 },
  textArea: { minHeight: 150, maxHeight: 230, borderWidth: 1, borderRadius: 12, padding: 14, textAlign: "right", writingDirection: "rtl", textAlignVertical: "top", fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  field: { gap: 6 }, fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#263246", textAlign: "right", writingDirection: "rtl" }, fieldInput: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: "#CAD6E8", backgroundColor: "#F9FBFD", paddingHorizontal: 14, color: "#172033", textAlign: "right", writingDirection: "rtl", fontFamily: fonts.body, fontSize: 15 },
  primaryButton: { minHeight: 54, borderRadius: 12, backgroundColor: palette.primary, flexDirection: "row-reverse", gap: 8, alignItems: "center", justifyContent: "center" }, primaryButtonDisabled: { opacity: 0.42 }, primaryButtonText: { fontFamily: fonts.bodyBold, color: "#fff", fontSize: 16 }, pressed: { opacity: 0.82 },
  couponSummary: { minHeight: 76, padding: 14, borderRadius: 10, backgroundColor: "#F5F8FF", flexDirection: "row-reverse", gap: 12, alignItems: "center", borderWidth: 1, borderColor: "#DCE7FA" }, check: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#28A071", alignItems: "center", justifyContent: "center" }, summaryCopy: { flex: 1 }, company: { fontFamily: fonts.bodyBold, fontSize: 17, color: "#172033", textAlign: "right", writingDirection: "rtl" }, details: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: "#5F6B7C", textAlign: "right", writingDirection: "rtl", marginTop: 2 }, missingText: { fontFamily: fonts.bodyBold, color: "#B54708", textAlign: "right", writingDirection: "rtl" },
  characterScene: { width: "100%", height: "100%", position: "relative", overflow: "hidden" }, sceneBase: { position: "absolute", width: "68%", height: "90%", left: "16%", top: "5%" }, sceneCharacter: { position: "absolute", width: "32%", height: "58%", bottom: "1%" }, sceneBlue: { left: "0%" }, sceneMint: { right: "0%" },
});
