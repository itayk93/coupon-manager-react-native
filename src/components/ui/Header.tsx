import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { ChevronRight, Bell } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useContentStyle } from "@/hooks/useResponsive";
import { fonts, radii } from "@/lib/theme";

/**
 * Which insets this bar pays, and why it is not all of them.
 *
 * It used to be react-native-web's `SafeAreaView`, which pads all four edges
 * from `env(safe-area-inset-*)` and, unlike UIKit, does not care where the
 * view actually sits. At the top of the screen that meant the bar carried the
 * home indicator's 34px as a white band under its own rule, on every screen of
 * the installed web app.
 *
 * The top inset is paid exactly once, and `app/_layout.tsx` is the other half
 * of this: it pays it everywhere except native iOS, so that is the one place
 * left for the bar to pay it.
 */
const SAFE_EDGES: Edge[] = Platform.OS === "ios" ? ["top"] : [];

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
  const { theme } = useAppTheme();
  const { user } = useAuth();
  // The bar runs edge to edge; its title lines up with the column below it.
  const contentStyle = useContentStyle("grid");

  return (
    <SafeAreaView edges={SAFE_EDGES} style={[styles.safeArea, { backgroundColor: theme.card }]}>
      {/* The bar and its rule run edge to edge; what is on it lines up
          with the content column below. */}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.card,
            borderBottomColor: theme.cardBorder,
          },
        ]}
      >
        <View style={[styles.container, contentStyle]}>
          <View style={styles.actionsGroup}>
            {rightAction ? (
              rightAction
            ) : (
              <>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: "100%",
  },
  bar: {
    borderBottomWidth: 1,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
