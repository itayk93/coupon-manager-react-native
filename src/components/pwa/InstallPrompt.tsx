import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Download, Share, TriangleAlert, X } from "lucide-react-native";
import { useSegments } from "expo-router";
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
 * Android gets a real button when the browser offers one. iOS gets the taps
 * written out, because Apple has no install API and the share sheet is the
 * only way in. Which browser the person is in decides the wording — see
 * `installTarget.ts` for why that is the axis that matters.
 *
 * It is a strip above the tab bar, not the covering sheet it used to be. Two
 * things pushed it there. Install promotion is advice, and a scrim over the
 * whole screen makes advice into a toll gate — the guidance on promoting
 * installation is a banner or a button the person can take or leave, never a
 * modal, and to ask again only when something changed in their relationship
 * with the app. Signing in *is* that change, which is the second thing: this
 * now waits for a session, so nobody is asked to keep an app they have not
 * decided to use yet.
 *
 * Collapsed it is one line. The iOS steps are three taps nobody needs in front
 * of them until they have said yes, so they live behind the button and the
 * strip grows only once asked. Rendered in the layout's own column rather than
 * floating over it, so it can never sit on top of the tab bar or a coupon.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** How long to let the page settle before interrupting it. */
const APPEAR_DELAY_MS = 2500;

export function InstallPrompt() {
  const { theme } = useAppTheme();
  const { session, user } = useAuth();
  const segments = useSegments();
  const [target, setTarget] = useState<InstallTarget | null>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  // Signed in, and past the screens where signing in happens. The same gate
  // the tab bar uses, for the same reason: until this is true there is no
  // "your wallet" to keep on a home screen.
  const signedIn = Boolean(session) && segments[0] !== "(auth)";

  useEffect(() => {
    if (!signedIn) return;
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
  }, [signedIn]);

  if (!signedIn || !visible || !target) return null;

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

  const canInstall = Boolean(deferred) && !guide.blocker;
  // Nothing to expand into when the browser will do it itself, and nothing
  // worth expanding into when it cannot install at all.
  const canExpand = !canInstall && !guide.blocker && guide.steps.length > 0;

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}
      accessibilityRole={Platform.OS === "web" ? undefined : "alert"}
    >
      <View style={styles.row}>
        <Image
          source={{ uri: "/pwa-192x192.png" }}
          style={[styles.icon, { backgroundColor: theme.primaryTint }]}
          resizeMode="contain"
          accessibilityLabel="קופון מאסטר"
        />

        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {guide.blocker ? guide.headline : "קופון מאסטר על מסך הבית"}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={2}>
            {guide.blocker ?? "נפתח מיד, בלי סרגל הכתובת"}
          </Text>
        </View>

        {canInstall ? (
          <Pressable
            accessibilityRole="button"
            onPress={install}
            style={[styles.cta, { backgroundColor: theme.primary }]}
          >
            <Download size={15} color="#ffffff" />
            <Text style={styles.ctaText}>{guide.action}</Text>
          </Pressable>
        ) : canExpand ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? "סגירת ההסבר" : "איך מוסיפים"}
            onPress={() => setExpanded((open) => !open)}
            style={[styles.cta, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.ctaText}>{expanded ? "סגור" : "איך?"}</Text>
            {expanded ? <ChevronDown size={15} color="#ffffff" /> : null}
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="אחר כך"
          onPress={dismiss}
          hitSlop={8}
          style={styles.close}
        >
          <X size={16} color={theme.textSubtle} />
        </Pressable>
      </View>

      {/* Only once asked. Three taps in front of someone who has not said yes
          is the bulk that made the old sheet cover the screen. */}
      {expanded && canExpand ? (
        <View style={styles.steps}>
          {guide.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryTint }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
            </View>
          ))}
          {target.platform === "ios" ? (
            <View style={styles.hint}>
              <Share size={13} color={theme.textMuted} />
              <Text style={[styles.hintText, { color: theme.textMuted }]}>
                כפתור השיתוף נמצא בתחתית המסך בספארי
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // In the layout's column, directly above the tab bar: a strip that shortens
  // the screen by its own height instead of covering what is on it.
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 9 },
  copy: { flex: 1, alignItems: "flex-end" },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#ffffff" },
  close: { padding: 4 },
  steps: { gap: 8, paddingTop: 10, paddingBottom: 2, paddingHorizontal: 2 },
  step: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  stepText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  hint: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingTop: 2 },
  hintText: { fontFamily: fonts.body, fontSize: 11.5 },
});
