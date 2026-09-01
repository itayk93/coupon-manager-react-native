import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { FileCheck2 } from "lucide-react-native";
import { ContentHeader, contentStyles } from "@/components/layout/ContentHeader";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

const UPDATED_AT = "1 בספטמבר 2026";

const SECTIONS = [
  {
    title: "1. קבלת התנאים",
    body: "השימוש בקופון מאסטר, באתר ובשירותים הנלווים כפוף לתנאים אלה ולמדיניות הפרטיות. אם התנאים אינם מקובלים, אין להשתמש בשירות.",
  },
  {
    title: "2. השירות",
    body: "קופון מאסטר מסייע לנהל, לתעד, לשתף ולעקוב אחר קופונים ושוברים. השירות אינו מנפיק קופונים, אינו בית העסק שמכבד אותם ואינו מבטיח שיתרה, תוקף או תנאי מימוש שהוזנו בידי משתמש או התקבלו מספק חיצוני יהיו מדויקים. יש לאמת את הפרטים מול מנפיק הקופון לפני שימוש או עסקה.",
  },
  {
    title: "3. חשבון ואבטחה",
    body: "יש למסור פרטים נכונים, לשמור על אמצעי ההתחברות ולא לאפשר שימוש בלתי מורשה בחשבון. יש להודיע בהקדם על חשד לגישה לא מורשית. אין להעלות קופון, אמצעי תשלום או מידע שאינך רשאי להחזיק או לשתף.",
  },
  {
    title: "4. שימוש מותר",
    body: "אין להשתמש בשירות להונאה, גניבה, התחזות, סחר בפרטים שהושגו שלא כדין, עקיפת מגבלות של מנפיק, פגיעה במשתמש אחר, ניסיון חדירה, שיבוש השירות, איסוף מידע אוטומטי ללא רשות או הפרת דין וזכויות צד שלישי.",
  },
  {
    title: "5. שיתוף והעברת קופונים",
    body: "שיתוף או העברה נעשים באחריות המשתמשים. לפני אישור יש לבדוק את זהות הצד השני, את היתרה ואת תנאי המנפיק. אין לראות ברישום באפליקציה אישור לבעלות, לתוקף או להשלמת תשלום בין משתמשים.",
  },
  {
    title: "6. תכונות AI ושירותים חיצוניים",
    body: "חילוץ פרטים מתמונה או טקסט ותוצרים אוטומטיים עלולים לטעות. חובה לבדוק את התוצאה לפני שמירה או שימוש. שירותים חיצוניים כפופים גם לתנאים שלהם, וזמינותם עשויה להשתנות.",
  },
  {
    title: "7. קניין רוחני",
    body: "הזכויות באפליקציה, בעיצוב, בקוד, במותג ובתוכן המקורי שמורות למפעיל או לבעלי הזכויות. המשתמש נשאר אחראי לתוכן שהעלה ומעניק הרשאה מוגבלת לעבדו רק לצורך הפעלת השירות.",
  },
  {
    title: "8. זמינות ושינויים",
    body: "השירות מסופק כפי שהוא וכפי שהוא זמין. ייתכנו תחזוקה, תקלות, שינוי תכונות או הפסקת רכיב. נעשה מאמץ סביר לשמור על שירות תקין, בלי התחייבות לזמינות רציפה או להתאמה לצורך מסוים.",
  },
  {
    title: "9. הגבלת אחריות",
    body: "במידה המרבית המותרת בדין, המפעיל לא יישא בנזק עקיף או תוצאתי, באובדן קופון, יתרה, רווח, מידע או עסקה בין משתמשים שנגרמו מהסתמכות על מידע בשירות, משירות חיצוני או משימוש שאינו בהתאם לתנאים. אין בסעיף זה כדי לגרוע מאחריות שלא ניתן להגביל לפי דין.",
  },
  {
    title: "10. השעיה וסיום",
    body: "ניתן להגביל או לסיים גישה במקרה של הפרת תנאים, סיכון אבטחה, שימוש לרעה או חובה חוקית. המשתמש רשאי להפסיק שימוש ולמחוק את החשבון מתוך הגדרות האפליקציה.",
  },
  {
    title: "11. דין ופניות",
    body: "על התנאים חל דין מדינת ישראל. סמכות השיפוט תהיה לבתי המשפט המוסמכים בישראל, בכפוף להוראות דין מחייבות. לשאלות, תלונות או בקשות: itayk93@gmail.com.",
  },
  {
    title: "12. עדכונים",
    body: "שינוי מהותי יוצג באפליקציה או באמצעי מתאים לפני כניסתו לתוקף, לפי הנדרש. המשך שימוש לאחר כניסת שינוי לתוקף מהווה קבלת הנוסח המעודכן.",
  },
] as const;

export function TermsScreen() {
  const { theme } = useAppTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ContentHeader />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.headerBox}>
            <FileCheck2 size={28} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>תנאי שימוש</Text>
          </View>
          <Text style={[styles.meta, { color: theme.textSubtle }]}>עודכן לאחרונה: {UPDATED_AT} · גרסה 1.0</Text>
          <Text style={[styles.intro, { color: theme.textMuted }]}>התנאים מסבירים את כללי השימוש בקופון מאסטר ואת האחריות של המשתמשים ושל מפעיל השירות.</Text>
          {SECTIONS.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.bodyText, { color: theme.textMuted }]}>{section.body}</Text>
            </View>
          ))}
        </View>
        <Text style={[contentStyles.footer, { color: theme.textSubtle, borderTopColor: theme.cardBorder }]}>קופון מאסטר © 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 40 },
  card: { borderRadius: 22, padding: 20, borderWidth: 1 },
  headerBox: { alignItems: "center", marginBottom: 20, gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 20, fontWeight: "800", textAlign: "center" },
  meta: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  intro: { fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 10 },
  sectionHeading: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", textAlign: "right", marginTop: 16, marginBottom: 6 },
  bodyText: { fontSize: 13, lineHeight: 20, textAlign: "right" },
});
