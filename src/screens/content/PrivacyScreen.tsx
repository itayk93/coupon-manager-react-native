import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Lock, Shield } from "lucide-react-native";
import { RootStackParamList } from "@/navigation/types";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "Privacy">;

export function PrivacyScreen({ navigation }: Props) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="מדיניות פרטיות" showBack onBack={() => navigation.goBack()} />

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
          <View style={styles.headerBox}>
            <Lock size={28} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>
              שמירה על פרטיותך בראש סדר העדיפויות
            </Text>
          </View>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            1. הצפנת נתונים
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            כל המידע הרגיש שלך, כולל קודי קופונים, מספרי שוברים, קודי CVV והערות אישיות, מוצפן באמצעות מפתחות הצפנה מתקדמים (Fernet Encryption).
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            2. שימוש במידע
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            המידע שלך משמש אך ורק למטרת ניהול הארנק הדיגיטלי האישי שלך. איננו מוכרים או משתפים את המידע שלך עם גורמים מסחריים צד שלישי.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            3. אבטחת חשבון
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            אנו משתמשים בתשתיות אימות מאובטחות מבוססות תקני האבטחה הגבוהים ביותר. תוכל לבקש מחיקה מלאה של חשבונך בכל עת.
          </Text>
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
    paddingVertical: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  headerBox: {
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 14,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
});
