import { useEffect, useState } from "react";
import {
  I18nManager,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  DefaultTheme as NavigationDefaultTheme,
  Stack,
  ThemeProvider,
  useGlobalSearchParams,
  usePathname,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from "@expo-google-fonts/heebo";
import { Outfit_600SemiBold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BiometricGate } from "@/components/layout/BiometricGate";
import { BrandLaunchAnimation } from "@/components/layout/BrandLaunchAnimation";
import { BrandWaitOverlay } from "@/components/layout/BrandWaitOverlay";
import { ScreenTransition } from "@/components/layout/ScreenTransition";
import { BottomNav } from "@/components/layout/BottomNav";
import { SideNav } from "@/components/layout/SideNav";
import { NativeErrorBoundary } from "@/components/layout/NativeErrorBoundary";
import { SharedScreenshotUsage } from "@/components/dashboard/SharedScreenshotUsage";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { ToastHost } from "@/components/ui/Toast";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { applyWebDocumentHead } from "@/lib/webDocumentHead";
import { hideWebBootSplash, paintWebBackground } from "@/lib/webBootSplash";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { rememberPendingRoute, takePendingRoute } from "@/lib/pendingRoute";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { useLocalExpiryAlerts } from "@/hooks/useLocalExpiryAlerts";
import { useScreenTracking } from "@/hooks/useScreenTracking";
import { useWebAppUpdate } from "@/hooks/useWebAppUpdate";
import { usePendingOnboardingCoupon } from "@/hooks/usePendingOnboardingCoupon";
import { ThemeProvider as AppThemeProvider, useAppTheme } from "@/contexts/ThemeContext";
import { fonts, DESKTOP_FRAME_WIDTH, DESKTOP_WEB_MIN_WIDTH } from "@/lib/theme";
import { peekSharedImport } from "coupon-widget";

// Hebrew RTL must be enabled before the first layout pass, so this runs at
// module scope rather than in an effect.
try {
  I18nManager.allowRTL(true);
} catch (e) {
  console.warn("RTL setup warning:", e);
}

// Cap extreme accessibility font scaling to 1.35x globally to preserve layout integrity
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.maxFontSizeMultiplier = 1.35;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.35;

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const navigationFonts = Platform.select({
  ios: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "600" },
    heavy: { fontFamily: "System", fontWeight: "700" },
  },
  default: {
    regular: { fontFamily: "sans-serif", fontWeight: "normal" },
    medium: { fontFamily: "sans-serif-medium", fontWeight: "normal" },
    bold: { fontFamily: "sans-serif", fontWeight: "600" },
    heavy: { fontFamily: "sans-serif", fontWeight: "700" },
  },
} as const);

// Auth-group routes that stay put with a session in hand. `reset-password` is
// reached from the recovery email, which signs the visitor in before they have
// chosen the new password — bouncing them to the tabs would skip the reset.
const AUTHED_AUTH_ROUTES = ["/onboarding", "/reset-password"];

/**
 * Central auth guard. Redirects only once the stored session has been resolved
 * and the root navigator is mounted, so we never bounce the user mid-restore.
 */
function useAuthGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const rootNavigationState = useRootNavigationState();
  const navigatorReady = Boolean(rootNavigationState?.key);

  const inAuthGroup = segments[0] === "(auth)";
  // `unsubscribe` is public for a legal reason, not a cosmetic one: an opt-out
  // link from an email has to work in the recipient's inbox, without a login.
  // `r` is public for the same reason: an invite link is opened by someone who
  // does not have an account yet, which is the entire point of it.
  const inPublicContent = ["about", "faq", "privacy", "terms", "issues", "unsubscribe", "r"].includes(
    String(segments[0] ?? ""),
  );

  useEffect(() => {
    if (isLoading || !navigatorReady) return;

    if (!session && !inAuthGroup && !inPublicContent) {
      // Keep the destination, query string included, so logging in finishes the
      // journey the link started instead of dropping the user on the home tab.
      const query = new URLSearchParams(
        Object.entries(params).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value] as [string, string]] : [],
        ),
      ).toString();
      rememberPendingRoute(query ? `${pathname}?${query}` : pathname);
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup && !AUTHED_AUTH_ROUTES.includes(pathname)) {
      const pendingRoute = takePendingRoute();
      router.replace((pendingRoute as any) ?? "/(tabs)");
    }
  }, [session, isLoading, navigatorReady, inAuthGroup, inPublicContent, router, pathname, params]);

  // Stay covered until the tree on screen matches the session, so the wrong
  // side of the guard is never briefly visible.
  const settled =
    !isLoading &&
    navigatorReady &&
    (session ? !inAuthGroup || AUTHED_AUTH_ROUTES.includes(pathname) : inAuthGroup || inPublicContent);

  return { isReady: settled };
}

function RootLayoutNav() {
  const { theme } = useAppTheme();
  const { isReady: authReady } = useAuthGuard();
  useWidgetSync();
  useLocalExpiryAlerts();
  // Web only: the installed PWA has no expo-updates to lean on.
  useWebAppUpdate();
  usePendingOnboardingCoupon();
  useScreenTracking();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width > DESKTOP_WEB_MIN_WIDTH;
  const [launchVisible, setLaunchVisible] = useState(Platform.OS !== "web" && !peekSharedImport());

  // Heebo carries the Hebrew body text; Outfit is the Latin display face used
  // for headings and figures in the redesign.
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    Outfit_600SemiBold,
    Outfit_800ExtraBold,
  });

  // A font failure — or a native font module that never settles its promise at
  // all — must not wedge the app behind the splash screen. After a short grace
  // period we proceed with system fonts regardless.
  const [fontWaitElapsed, setFontWaitElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontWaitElapsed(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const fontsSettled = fontsLoaded || Boolean(fontError) || fontWaitElapsed;

  const isReady = authReady && fontsSettled;

  useEffect(() => {
    if (fontsSettled && !launchVisible) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsSettled, launchVisible]);

  // Web has no native splash to hide and no launch animation to play: its
  // launch screen is in the document, painted before this bundle existed. It
  // stays up until the tree on screen is the one the session calls for, so the
  // wait reads as one screen rather than a logo, a flash and a spinner.
  useEffect(() => {
    if (Platform.OS !== "web" || !isReady) return;
    hideWebBootSplash();
    // The document was painted the launch screen's tint; from here the app's
    // own surface owns it, in whichever theme is running.
    paintWebBackground(theme.background);
  }, [isReady, theme.background]);

  const navigationBaseTheme = NavigationDefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navigationBaseTheme,
        dark: false,
        fonts: navigationBaseTheme.fonts ?? navigationFonts,
        colors: {
          primary: theme.primary,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          notification: theme.danger,
        },
      }}
    >
      <StatusBar style="dark" />
      <View style={[styles.outerShell, isDesktopWeb && styles.outerShellDesktop]}>
        <View
          style={[
            styles.shell,
            { backgroundColor: theme.background },
            isDesktopWeb && styles.shellDesktop,
          ]}
        >
          <SafeAreaView
            // Web joins Android here: once the viewport covers the notch, the
            // top inset is ours to pay too. Native iOS keeps its own.
            edges={Platform.OS === "ios" ? [] : ["top"]}
            style={[styles.appViewport, { backgroundColor: theme.background }]}
          >
            {/* One shape for every device: the rail draws nothing on a phone
                and the bottom bar draws nothing on a tablet, so rotating across
                the breakpoint moves the navigation without remounting the
                navigator under it. */}
            <View style={styles.shellRow}>
              <SideNav />
              <View style={styles.mainColumn}>
                {/* `animation` below is a native-stack option and does
                    nothing on web, where screens are swapped in place; the
                    wrapper is what moves them there, and nothing at all on
                    native. */}
                <ScreenTransition>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "slide_from_right",
                      contentStyle: { backgroundColor: theme.background },
                    }}
                  />
                </ScreenTransition>
                {/* Above the tab bar and inside the column: the install strip
                    takes its own height off the screen rather than floating
                    over what is on it. */}
                <InstallPrompt />
                <BottomNav />
              </View>
            </View>
          </SafeAreaView>
          <BiometricGate />
          <SharedScreenshotUsage />
          <ConfirmHost />
          <ToastHost />

          {launchVisible ? (
            <BrandLaunchAnimation
              appReady={isReady}
              canReveal={fontsSettled}
              onFinish={() => setLaunchVisible(false)}
            />
          ) : null}

          <BrandWaitOverlay visible={!isReady && !launchVisible} />
        </View>
        {isDesktopWeb ? (
          <Text style={[styles.webFooterText, { color: theme.textSubtle }]}>
            © קופון מאסטר
          </Text>
        ) : null}
      </View>
    </ThemeProvider>
  );
}

// Runs once, before the first screen, and only where there is a document.
// See `webDocumentHead.ts` for why this is not in an HTML file.
if (Platform.OS === "web" && typeof document !== "undefined") {
  applyWebDocumentHead();
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppThemeProvider>
              <NativeErrorBoundary>
                <RootLayoutNav />
              </NativeErrorBoundary>
            </AppThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  outerShell: {
    flex: 1,
    backgroundColor: "transparent",
  },
  outerShellDesktop: {
    backgroundColor: "#edf2f7",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  shell: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  // The rail and the page sit side by side, reversed because the app reads
  // right to left, so the navigation lands on the side the thumb and the eye
  // both start from.
  shellRow: {
    flex: 1,
    flexDirection: "row-reverse",
  },
  mainColumn: {
    flex: 1,
  },
  appViewport: {
    flex: 1,
  },
  shellDesktop: {
    maxWidth: DESKTOP_FRAME_WIDTH,
    maxHeight: 880,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    boxShadow: "0px 12px 32px rgba(15, 23, 42, 0.12)",
    elevation: 10,
  },
  webFooterText: {
    fontSize: 12,
    fontFamily: fonts.body,
    marginTop: 10,
    opacity: 0.7,
  },
});
