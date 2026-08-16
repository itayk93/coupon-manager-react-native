import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, StatusBar } from "react-native";
import { ChevronRight, Bell, Moon, Sun } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { fonts, radii } from "@/lib/theme";

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
          backgroundColor: theme.card,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.card,
            borderBottomColor: theme.cardBorder,
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
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                {isDark ? (
                  <Sun size={18} color="#fbbf24" />
                ) : (
                  <Moon size={18} color={theme.textMuted} />
                )}
              </TouchableOpacity>

              {showNotifications ? (
                <TouchableOpacity
                  onPress={onNotificationsPress}
                  style={[
                    styles.iconButton,
                    { backgroundColor: theme.surfaceAlt },
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
              { backgroundColor: theme.surfaceAlt },
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
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
    alignItems: "flex-end",
    paddingHorizontal: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
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
    borderRadius: radii.md,
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
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    width: 8,
  },
});
