import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Lock, Shield } from "lucide-react-native";
import { ContentHeader, contentStyles } from "@/components/layout/ContentHeader";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";

export function PrivacyScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ContentHeader />

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
            המידע שלך משמש אך ורק לניהול הארנק הדיגיטלי האישי שלך. איננו מוכרים את המידע. איננו משתפים אותו עם צד שלישי, למעט שירותי תשתית חיוניים (אירוח, שליחת דוא"ל, וגזירת עיר ואזור מכתובת IP) הפועלים לפי הוראותינו בלבד.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            3. אבטחת חשבון
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            אנו משתמשים בתשתיות אימות מאובטחות מבוססות תקני האבטחה הגבוהים ביותר. תוכל לבקש מחיקה מלאה של חשבונך בכל עת.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            4. תיעוד פעילות ומיקום
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            לשיפור המוצר ולמניעת ניצול לרעה של תוכנית ההפניות אנו רושמים פעולות בסיסיות באפליקציה: מסכים שנצפו, פעולות על קופונים, סוג המכשיר, וכתובת ה-IP שממנה בוצעה הפעולה. כתובת ה-IP נשמרת עד 90 יום ואז נמחקת. מתוכה נגזרים עיר ואזור כלליים (למשל "תל אביב") שאינם מזהים אותך אישית ונשמרים לניתוח סטטיסטי. לצורך גזירת המיקום כתובת ה-IP נשלחת לשירות geolocation חיצוני; לא נשלח אליו מידע מזהה אחר. פעילות זו נמחקת יחד עם החשבון.
          </Text>
        </View>
        <Text style={[contentStyles.footer, { color: theme.textSubtle, borderTopColor: theme.cardBorder }]}>
          קופון מאסטר © 2026
        </Text>
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
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  sectionHeading: {
    fontFamily: fonts.display,
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
