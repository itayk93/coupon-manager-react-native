import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AlertCircle, Send } from "lucide-react-native";
import { RootStackParamList } from "@/navigation/types";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";

type Props = NativeStackScreenProps<RootStackParamList, "Issues">;

export function IssuesScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      notify.error("יש למלא נושא ותיאור לפני השליחה");
      return;
    }
    setLoading(true);

    try {
      // Simulate submission / send
      await new Promise((resolve) => setTimeout(resolve, 800));
      notify.success("הפנייה נשלחה בהצלחה!", "צוות התמיכה יבדוק את הפנייה בהקדם.");
      navigation.goBack();
    } catch (e: any) {
      notify.error("שגיאה בשליחת הפנייה", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="דיווח על תקלה" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.headerBox}>
            <AlertCircle size={28} color={theme.primary} />
            <Text style={[styles.title, { color: theme.text }]}>
              נתקלת בבעיה? אנחנו כאן לעזור!
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              תאר את התקלה ונעשה הכל כדי לפתור אותה במהירות
            </Text>
          </View>

          <Input
            label="נושא הפנייה *"
            placeholder="למשל: בעיה בסריקת ברקוד..."
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={[styles.label, { color: theme.text }]}>
            תיאור מפורט של התקלה *
          </Text>
          <TextInput
            multiline
            numberOfLines={6}
            placeholder="פרט מה קרה, באיזה שלב, ומה הציפייה..."
            placeholderTextColor={theme.textMuted}
            value={description}
            onChangeText={setDescription}
            style={[
              styles.textArea,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Button
            title="שלח דיווח לצוות"
            onPress={handleSubmit}
            loading={loading}
            icon={<Send size={16} color="#ffffff" />}
            style={{ marginTop: 16 }}
          />
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
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "right",
  },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    height: 140,
    textAlignVertical: "top",
    textAlign: "right",
    fontSize: 14,
    lineHeight: 20,
  },
});
