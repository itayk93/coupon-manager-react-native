import { pushConfirm } from "@/components/ui/ConfirmDialog";
import { pushToast } from "@/components/ui/Toast";

/**
 * App notifications.
 *
 * success/error/warning are non-blocking toasts. `confirm` opens an in-app RTL
 * dialog — never Alert.alert, which lays its buttons out left-to-right with
 * English system labels ("OK"/"Cancel") and is a silent no-op on web.
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

  undo: (title: string, message: string, onUndo: () => void, duration = 5000) => {
    pushToast("warning", title, message, {
      actionLabel: "ביטול",
      onAction: onUndo,
      duration,
    });
  },

  confirm: (title: string, message: string, onConfirm: () => void, confirmText = "אישור") => {
    pushConfirm(title, message, onConfirm, confirmText);
  },
};
