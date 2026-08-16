import { Alert, Platform } from "react-native";
import { pushToast } from "@/components/ui/Toast";

/**
 * App notifications.
 *
 * success/error/warning are non-blocking toasts — they never interrupt with a
 * modal dialog. Only `confirm` still uses a real dialog, because it guards
 * destructive actions (deleting coupons) and needs an explicit answer.
 */
export const notify = {
  success: (title: string, message?: string) => {
    pushToast("success", title, message);
  },

  error: (title: string, message?: string) => {
    pushToast("error", title, message);
  },

  warning: (title: string, message?: string) => {
    pushToast("warning", title, message);
  },

  confirm: (title: string, message: string, onConfirm: () => void, confirmText = "אישור") => {
    // react-native-web's Alert.alert is a no-op, which silently swallowed every
    // confirmed action on web (revoking a share, deleting a coupon).
    if (Platform.OS === "web") {
      const ok =
        typeof globalThis.confirm === "function"
          ? globalThis.confirm(`${title}\n\n${message}`)
          : true;
      if (ok) onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: "ביטול", style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  },
};
