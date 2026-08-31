import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Share, Sparkles, TriangleAlert, X } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { isFemaleUser } from "@/lib/gender";
import { fonts, radii } from "@/lib/theme";
import {
  describeInstallTarget,
  installGuide,
  shouldOfferInstall,
  type InstallTarget,
} from "@/lib/installTarget";
import {
  isInstallPromptSnoozed,
  markInstalled,
  snoozeInstallPrompt,
} from "@/lib/installPromptState";

/**
 * The invitation to install the web app, shown only where it can be acted on:
 * a phone browser, not the native app, not a desktop, not an already-installed
 * window.
 *
 * Android gets a real button when the browser offers one. iOS gets pictures of
 * the taps, because Apple has no install API and the share sheet is the only
 * way in. Which browser the person is in decides the wording — see
 * `installTarget.ts` for why that is the axis that matters.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** How long to let the page settle before interrupting it. */
const APPEAR_DELAY_MS = 2500;

export function InstallPrompt() {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const [target, setTarget] = useState<InstallTarget | null>(null);
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      // iOS never adopted `display-mode`; this is Safari's own flag.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    const environment = {
      userAgent: window.navigator.userAgent,
      standalone,
      // A phone-sized viewport with a coarse pointer. Neither test alone is
      // enough: a narrow desktop window is not a phone, and a touchscreen
      // laptop is not either.
      mobile:
        window.innerWidth < 820 && window.matchMedia?.("(pointer: coarse)").matches === true,
    };

    if (!shouldOfferInstall(environment)) return;
    if (isInstallPromptSnoozed()) return;

    setTarget(describeInstallTarget(environment.userAgent));

    // Chromium offers to do the install itself. Holding the event is what lets
    // a button exist; without this it fires once and is gone.
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      markInstalled();
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !target) return null;

  const guide = installGuide(target, isFemaleUser(user?.gender));

  const dismiss = () => {
    snoozeInstallPrompt();
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      markInstalled();
      setVisible(false);
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={dismiss} accessibilityLabel="סגירה" />
      <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="אחר כך"
          onPress={dismiss}
          style={[styles.close, { backgroundColor: theme.surfaceAlt }]}
        >
          <X size={18} color={theme.textMuted} />
        </Pressable>

        <View style={[styles.iconWrap, { backgroundColor: theme.primaryTint }]}>
          <Image
            source={{ uri: "/pwa-192x192.png" }}
            style={styles.icon}
            resizeMode="contain"
            accessibilityLabel="קופון מאסטר"
          />
        </View>

        <Text style={[styles.headline, { color: theme.text }]}>{guide.headline}</Text>

        {guide.blocker ? (
          <View style={[styles.blocker, { backgroundColor: theme.warningBg }]}>
            <TriangleAlert size={16} color={theme.warningText} />
            <Text style={[styles.blockerText, { color: theme.warningText }]}>{guide.blocker}</Text>
          </View>
        ) : (
          <Text style={[styles.pitch, { color: theme.textSecondary }]}>
            נפתח מיד ממסך הבית, בלי סרגל הכתובת, ועובד גם כשאין קליטה.
          </Text>
        )}

        {deferred && !guide.blocker ? (
          <Pressable
            accessibilityRole="button"
            onPress={install}
            style={[styles.cta, { backgroundColor: theme.primary }]}
          >
            <Download size={18} color="#ffffff" />
            <Text style={styles.ctaText}>{guide.action}</Text>
          </Pressable>
        ) : (
          <View style={styles.steps}>
            {guide.steps.map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primaryTint }]}>
                  <Text style={[styles.stepNumberText, { color: theme.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {target.platform === "ios" && !guide.blocker ? (
          <View style={styles.hint}>
            <Share size={14} color={theme.textMuted} />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              כפתור השיתוף נמצא בתחתית המסך בספארי
            </Text>
          </View>
        ) : null}

        {!guide.blocker && !deferred ? (
          <View style={styles.hint}>
            <Sparkles size={14} color={theme.textMuted} />
            <Text style={[styles.hintText, { color: theme.textMuted }]}>לוקח פחות מחצי דקה</Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={dismiss} style={styles.later}>
          <Text style={[styles.laterText, { color: theme.textMuted }]}>אחר כך</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    zIndex: 9999,
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 26,
    gap: 12,
    alignItems: "center",
  },
  close: { position: "absolute", top: 14, left: 14, padding: 8, borderRadius: radii.pill },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  icon: { width: 56, height: 56 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 19,
    textAlign: "center",
    lineHeight: 27,
  },
  pitch: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", lineHeight: 21 },
  blocker: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: radii.lg,
    padding: 12,
  },
  blockerText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: "right" },
  steps: { alignSelf: "stretch", gap: 10, marginTop: 4 },
  step: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 14, textAlign: "right", lineHeight: 20 },
  cta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    borderRadius: radii.pill,
    paddingVertical: 14,
    marginTop: 4,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#ffffff" },
  hint: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  hintText: { fontFamily: fonts.body, fontSize: 12 },
  later: { paddingVertical: 8, paddingHorizontal: 16 },
  laterText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
