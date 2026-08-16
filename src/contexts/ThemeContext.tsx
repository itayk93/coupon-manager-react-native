import React, { createContext, useContext } from "react";
import { getTheme, ThemeMode } from "@/lib/theme";

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  theme: ReturnType<typeof getTheme>;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // "Coupon Master - Redesign" is a light-only system, so the mode is fixed.
  // setMode/toggleTheme are kept as no-ops so consumers keep compiling.
  const mode: ThemeMode = "light";

  const setMode = (_newMode: ThemeMode) => {};

  const toggleTheme = () => {};

  const theme = getTheme(mode);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark: false,
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
