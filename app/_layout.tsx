import { useEffect } from "react";
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
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { BottomNav } from "@/components/layout/BottomNav";
import { NativeErrorBoundary } from "@/components/layout/NativeErrorBoundary";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { ToastHost } from "@/components/ui/Toast";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { ThemeProvider as AppThemeProvider, useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

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

/**
 * Central auth guard. Redirects only once the stored session has been resolved
 * and the root navigator is mounted, so we never bounce the user mid-restore.
 */
function useAuthGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigatorReady = Boolean(rootNavigationState?.key);

  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (isLoading || !navigatorReady) return;

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, navigatorReady, inAuthGroup, router]);

  // Stay covered until the tree on screen matches the session, so the wrong
  // side of the guard is never briefly visible.
  const settled =
    !isLoading && navigatorReady && (session ? !inAuthGroup : inAuthGroup);

  return { isReady: settled };
}

function RootLayoutNav() {
  const { theme } = useAppTheme();
  const { isReady: authReady } = useAuthGuard();
  useWidgetSync();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width > 480;

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
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

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
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <BottomNav />
          <BiometricGate />
          <ConfirmHost />
          <ToastHost />

          {!isReady ? (
            <View
              style={[styles.loadingOverlay, { backgroundColor: theme.background }]}
              pointerEvents="auto"
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
  );
}

const styles = StyleSheet.create({
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
  shellDesktop: {
    maxWidth: 430,
    maxHeight: 880,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
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
