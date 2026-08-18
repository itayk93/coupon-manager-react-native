import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.code, { color: theme.primary }]}>404</Text>
      <Text style={[styles.title, { color: theme.text }]}>אופס! הדף לא נמצא.</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        הדף שניסית להגיע אליו לא קיים, הוסר, או שהקישור שבור.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text style={styles.buttonText}>חזרה לדף הבית</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  code: {
    fontFamily: fonts.display,
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 21,
  },
  button: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});
