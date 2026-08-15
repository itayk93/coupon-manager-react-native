import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Sparkles, ShieldCheck, Zap, Heart } from "lucide-react-native";
import { RootStackParamList } from "@/navigation/types";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "About">;

export function AboutScreen({ navigation }: Props) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="אודות" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.iconCircle}>
            <Sparkles size={36} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            Coupon Master
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            הארנק הדיגיטלי המתקדם בישראל לניהול קופונים ושוברים
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={[styles.featureText, { color: theme.text }]}>
                הצפנת Fernet ברמה צבאית להגנה על כל הקודים והנתונים שלך
              </Text>
              <ShieldCheck size={20} color={theme.primary} />
            </View>

            <View style={styles.featureItem}>
              <Text style={[styles.featureText, { color: theme.text }]}>
                סורק ברקודים ומצלמה לזיהוי שוברים תוך שניות
              </Text>
              <Zap size={20} color={theme.primary} />
            </View>

            <View style={styles.featureItem}>
              <Text style={[styles.featureText, { color: theme.text }]}>
                מעקב יתרות, התראות על תוקף קופונים ודוחות חיסכון
              </Text>
              <Heart size={20} color={theme.primary} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
  },
  featuresList: {
    width: "100%",
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
    textAlign: "right",
    lineHeight: 20,
    fontWeight: "600",
  },
});
