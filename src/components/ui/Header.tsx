import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, StatusBar } from "react-native";
import { ChevronRight, Bell, Moon, Sun } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

type HeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  showNotifications?: boolean;
  onNotificationsPress?: () => void;
  hasUnreadNotifications?: boolean;
};

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  showNotifications = false,
  onNotificationsPress,
  hasUnreadNotifications = false,
}: HeaderProps) {
  const { theme, toggleTheme, isDark } = useAppTheme();
  const { user } = useAuth();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.actionsGroup}>
          {rightAction ? (
            rightAction
          ) : (
            <>
              <TouchableOpacity
                onPress={toggleTheme}
                style={[
                  styles.iconButton,
                  { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
                ]}
              >
                {isDark ? (
                  <Sun size={18} color="#fbbf24" />
                ) : (
                  <Moon size={18} color="#64748b" />
                )}
              </TouchableOpacity>

              {showNotifications ? (
                <TouchableOpacity
                  onPress={onNotificationsPress}
                  style={[
                    styles.iconButton,
                    { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
                  ]}
                >
                  <Bell size={18} color={theme.text} />
                  {hasUnreadNotifications ? (
                    <View style={[styles.badgeDot, { backgroundColor: theme.danger }]} />
                  ) : null}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: theme.text, textAlign: "right" }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[
                styles.subtitle,
                { color: theme.textMuted, textAlign: "right" },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[
              styles.backButton,
              { backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9" },
            ]}
          >
            <ChevronRight size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleContainer: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 8,
  },
});
