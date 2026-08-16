import React, { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useAppTheme } from "@/contexts/ThemeContext";
import { RootNavigator } from "@/navigation/RootNavigator";

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
});

function AppContent() {
  const { isDark, theme } = useAppTheme();
  const navigationBaseTheme = isDark
    ? NavigationDarkTheme
    : NavigationDefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...navigationBaseTheme,
        dark: isDark,
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
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // Enable RTL support for Hebrew
    try {
      I18nManager.allowRTL(true);
    } catch (e) {
      console.warn("RTL setup warning:", e);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
