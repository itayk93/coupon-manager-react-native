import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";

const LINKS = [
  { label: "אודות", path: "/about" },
  { label: "שאלות נפוצות", path: "/faq" },
  { label: "מדיניות פרטיות", path: "/privacy" },
] as const;

/**
 * Top bar for the public content pages (about / FAQ / privacy), per the
 * redesign: brand on one side, section links in the middle, a login action on
 * the other side.
 */
export function ContentHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useAppTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
      <TouchableOpacity
        onPress={() => router.navigate("/(tabs)")}
        activeOpacity={0.8}
        style={styles.brand}
      >
        <Image
          source={require("../../../public/logo-icon.png")}
          style={styles.mark}
          resizeMode="contain"
        />
        <Text style={[styles.brandText, { color: theme.text }]}>קופון מאסטר</Text>
      </TouchableOpacity>

      <View style={styles.nav}>
        {LINKS.map((link) => {
          const active = pathname === link.path;
          return (
            <TouchableOpacity key={link.path} onPress={() => router.push(link.path)}>
              <Text
                style={[
                  styles.navText,
                  { color: active ? theme.primary : theme.textSecondary },
                ]}
              >
                {link.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brand: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 9,
  },
  brandText: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
  },
  nav: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 20,
  },
  navText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "600",
  },
});

export const contentStyles = StyleSheet.create({
  eyebrow: {
    alignSelf: "flex-end",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  eyebrowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "right",
    marginBottom: 16,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 28,
    textAlign: "right",
    marginBottom: 32,
  },
  footer: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
    borderTopWidth: 1,
  },
});
