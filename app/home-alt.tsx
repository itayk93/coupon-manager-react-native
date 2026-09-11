import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { HomeAltScreen } from "@/screens/dashboard/HomeAltScreen";

/**
 * The experimental home screen, while it is still an experiment.
 *
 * It is not on the tab bar and the only link to it is inside the admin panel,
 * but a route is a URL: anyone could type it. Non-admins are sent to the real
 * home rather than shown a half-finished screen.
 */
export default function HomeAltRoute() {
  const { isAdmin, isLoading } = useAuth();
  const { theme } = useAppTheme();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) return <Redirect href="/" />;

  return <HomeAltScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
