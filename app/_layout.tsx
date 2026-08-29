import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Platform,
  StyleSheet,
  Text,
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
import { BrandLaunchVideo } from "@/components/layout/BrandLaunchVideo";
import { BottomNav } from "@/components/layout/BottomNav";
import { NativeErrorBoundary } from "@/components/layout/NativeErrorBoundary";
import { SharedScreenshotUsage } from "@/components/dashboard/SharedScreenshotUsage";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { ToastHost } from "@/components/ui/Toast";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { rememberPendingRoute, takePendingRoute } from "@/lib/pendingRoute";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { useLocalExpiryAlerts } from "@/hooks/useLocalExpiryAlerts";
import { useScreenTracking } from "@/hooks/useScreenTracking";
import { usePendingOnboardingCoupon } from "@/hooks/usePendingOnboardingCoupon";
import { ThemeProvider as AppThemeProvider, useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";
// Imported for its side effect: the geofencing task must be defined before
// the system can hand an event to it, including on a cold start where the app
// was launched by that event.
import "@/lib/nearbyAlerts";
import { peekSharedImport } from "coupon-widget";

// Hebrew RTL must be enabled before the first layout pass, so this runs at
// module scope rather than in an effect.
try {
  I18nManager.allowRTL(true);
} catch (e) {
  console.warn("RTL setup warning:", e);
}

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
  const inPublicContent = ["about", "faq", "privacy", "issues", "unsubscribe", "r"].includes(
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
  usePendingOnboardingCoupon();
  useScreenTracking();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width > 480;
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

  // A font failure must not wedge the app behind the splash screen.
  const isReady = authReady && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (Platform.OS === "web" && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontsLoaded]);

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
            edges={Platform.OS === "android" ? ["top"] : []}
            style={[styles.appViewport, { backgroundColor: theme.background }]}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: theme.background },
              }}
            />
            <BottomNav />
          </SafeAreaView>
          <BiometricGate />
          <SharedScreenshotUsage />
          <ConfirmHost />
          <ToastHost />

          {launchVisible ? (
            <BrandLaunchVideo
              appReady={isReady}
              canReveal={fontsLoaded || Boolean(fontError)}
              onFinish={() => setLaunchVisible(false)}
            />
          ) : null}

          {!isReady && !launchVisible ? (
            <View
              style={[styles.loadingOverlay, { backgroundColor: theme.background, pointerEvents: "auto" }]}
            >
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : null}
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
  appViewport: {
    flex: 1,
  },
  shellDesktop: {
    maxWidth: 430,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
