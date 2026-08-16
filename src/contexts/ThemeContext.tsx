import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTheme, ThemeMode } from "@/lib/theme";

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  theme: ReturnType<typeof getTheme>;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const THEME_KEY = "coupon_master_theme_mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  // The redesign is a light system; dark stays available via the settings toggle.
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
      } else if (systemColorScheme) {
        setModeState(systemColorScheme === "dark" ? "dark" : "light");
      }
    });
  }, [systemColorScheme]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode).catch(() => {});
  };

  const toggleTheme = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
  };

  const theme = getTheme(mode);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark: mode === "dark",
        theme,
        setMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return context;
}
