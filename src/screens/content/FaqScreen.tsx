import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react-native";
import { ContentHeader, contentStyles } from "@/components/layout/ContentHeader";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";

const FAQ_ITEMS = [
  {
    q: "כיצד הקופונים שלי מוצפנים ונשמרים?",
    a: "כל קודי הקופונים, מספרי הכרטיסים, קודי ה-CVV והערות הפירוט מוצפנים באמצעות אלגוריתם ההצפנה Fernet (AES-128-CBC + HMAC-SHA256). רק אתה יכול לצפות בהם לאחר התחברות.",
  },
  {
    q: "איך עובד עדכון היתרות האוטומטי?",
    a: "עבור שוברים תומכים (כגון BuyMe, מולטיפאס, מקס), המערכת בודקת את יתרת השובר מול שרתי הספק ומעדכנת את היתרה בארנק שלך באופן שוטף.",
  },
  {
    q: "האם ניתן להשתמש בקופון בחלקים?",
    a: "כן! באמצעות כפתור 'דיווח שימוש' תוכל להזין כל סכום שנוצל בקופה, והיתרה הנותרת תתעדכן אוטומטית.",
  },
  {
    q: "כיצד עובד שיתוף קופונים?",
    a: "תוכל לשתף קופון עם משתמש אחר באמצעות כתובת המייל שלו. המשתמש יוכל לראות את הקופון בארנק שלו ולממש אותו.",
  },
];

export function FaqScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ContentHeader />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = expandedIdx === idx;
          return (
            <View
              key={idx}
              style={[
                styles.itemCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggle(idx)}
                style={styles.itemHeader}
                activeOpacity={0.8}
              >
                {isOpen ? (
                  <ChevronUp size={18} color={theme.primary} />
                ) : (
                  <ChevronDown size={18} color={theme.textMuted} />
                )}
                <Text style={[styles.questionText, { color: theme.text }]}>
                  {item.q}
                </Text>
              </TouchableOpacity>

              {isOpen ? (
                <View
                  style={[
                    styles.answerBox,
                    { borderTopColor: theme.border },
                  ]}
                >
                  <Text style={[styles.answerText, { color: theme.textMuted }]}>
                    {item.a}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
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
  itemCard: {
    ...shadows.card,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  questionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
  answerBox: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
});
