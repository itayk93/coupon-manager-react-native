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

          <Text style={[styles.bodyText, { color: theme.textSubtle }]}>
            עודכן לאחרונה: 30 באוגוסט 2026 · גרסה 2.0
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            1. איזה מידע אנחנו אוספים
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            • פרטי חשבון: שם, כתובת אימייל, ואם בחרת — תמונת פרופיל ותיאור.{"\n"}
            • הקופונים שלך: שם החברה, קוד/שובר, ערך, תוקף, קוד CVV והערות שתוסיף.{"\n"}
            • היסטוריית שימוש: סכומים, שמות ומיקום של בתי עסק שבהם מימשת קופון, ותאריכים.{"\n"}
            • נתוני שימוש: מסכים שנצפו, פעולות על קופונים, סוג המכשיר, וכתובת IP.{"\n"}
            • הסכמות, העדפות התראות, וטוקן להתראות דחיפה.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            2. הצפנה
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            המידע הרגיש — קודי קופונים, מספרי שוברים, קודי CVV, תוקף כרטיס והערות אישיות — מוצפן (Fernet / AES) בצד השרת. מפתחות ההצפנה אינם נשמרים במכשיר שלך ואינם נחשפים באפליקציה.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            3. למה אנחנו משתמשים במידע ועל בסיס מה
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            המידע משמש לניהול הארנק הדיגיטלי שלך (ביצוע החוזה מולך), לשיפור המוצר ולמניעת הונאה בתוכנית ההפניות (אינטרס לגיטימי), ולדיוור — רק אם נתת הסכמה. איננו מוכרים מידע ואיננו משתמשים בו לפרסום ממוקד של צד שלישי.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            4. עיבוד באמצעות בינה מלאכותית
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            כשאתה מוסיף קופון מטקסט או מצילום מסך, או מעלה צילום מסך של מימוש, הטקסט או התמונה נשלחים ל-OpenAI לצורך זיהוי הפרטים בלבד. OpenAI אינה מאמנת מודלים על המידע הזה. התמונות אינן נשמרות אצלנו לאחר העיבוד. אפשר להזין קופון גם ידנית וכך לא לשלוח דבר ל-OpenAI.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            5. עם מי המידע משותף (ספקי משנה)
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            • Supabase — אירוח, בסיס נתונים ואימות.{"\n"}
            • OpenAI — זיהוי פרטי קופון מטקסט/תמונה (ראה סעיף 4).{"\n"}
            • ספק שליחת דוא"ל — מיילים תפעוליים ודיוור.{"\n"}
            • שירות geolocation — גזירת עיר ואזור מכתובת IP בלבד.{"\n"}
            • Apple / Google — משלוח התראות דחיפה.{"\n"}
            כל הספקים פועלים לפי הוראותינו בלבד.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            6. העברת מידע אל מחוץ לישראל / האיחוד האירופי
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            השרתים ו-OpenAI ממוקמים בין היתר בארצות הברית. ההעברה מתבצעת על בסיס תניות חוזיות סטנדרטיות ואמצעי הגנה מקובלים.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            7. תיעוד פעילות ומיקום
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            אנו רושמים פעולות בסיסיות: מסכים שנצפו, פעולות על קופונים, סוג המכשיר וכתובת ה-IP. כתובת ה-IP נשמרת עד 90 יום ואז נמחקת; מתוכה נגזרים עיר ואזור כלליים (למשל "תל אביב") שאינם מזהים אותך אישית. לצורך הגזירה כתובת ה-IP נשלחת לשירות geolocation חיצוני ללא מידע מזהה אחר. רשומות הפעילות עצמן נשמרות עד 400 יום.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            8. מחיקת קופונים ושחזור
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            קופון שנמחק עובר לתיקיית "נמחקו לאחרונה" (בהגדרות) ולא נמחק מיד, כדי שאפשר יהיה לשחזר מחיקה בטעות. הוא נשמר שם עד 30 יום ואז נמחק לצמיתות אוטומטית. אפשר גם למחוק לצמיתות באופן מיידי מאותו מסך.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            9. הזכויות שלך
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            • עיון וניוד: "הגדרות ← החשבון והמידע שלי ← הורדת המידע שלי" מפיק קובץ עם כל המידע שלך.{"\n"}
            • תיקון: עריכת הפרופיל במסך הפרופיל.{"\n"}
            • מחיקה: "הגדרות ← מחיקת החשבון" מוחקת מיד את כל הקופונים, ההיסטוריה, ההגדרות והפרטים — כולל מה שבתיקיית "נמחקו לאחרונה" — ואת זהות ההתחברות.{"\n"}
            • משיכת הסכמה לדיוור: כפתור ביטול הדיוור בהגדרות ההתראות.{"\n"}
            • תלונה: לרשות להגנת הפרטיות (ישראל) או לרשות הפיקוח הרלוונטית באיחוד האירופי.
          </Text>

          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            10. יצירת קשר
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            לשאלות בנושא פרטיות ולמימוש זכויות: itayk93@gmail.com. נענה תוך 30 יום.
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
