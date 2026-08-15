import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export const notify = {
  success: (title: string, message?: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (Platform.OS === "web") {
      alert(title + (message ? `\n${message}` : ""));
    } else {
      Alert.alert(title, message, [{ text: "אישור" }]);
    }
  },

  error: (title: string, message?: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    if (Platform.OS === "web") {
      alert("שגיאה: " + title + (message ? `\n${message}` : ""));
    } else {
      Alert.alert("שגיאה", title + (message ? `\n${message}` : ""), [{ text: "אישור" }]);
    }
  },

  warning: (title: string, message?: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    Alert.alert(title, message, [{ text: "אישור" }]);
  },

  confirm: (title: string, message: string, onConfirm: () => void, confirmText = "אישור") => {
    Alert.alert(title, message, [
      { text: "ביטול", style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  },
};
