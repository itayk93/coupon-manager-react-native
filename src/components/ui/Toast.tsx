import React from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";

export type ToastKind = "success" | "error" | "warning";

export type ToastPayload = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type Listener = (toast: ToastPayload) => void;

let listener: Listener | null = null;
let nextId = 1;

/** Queue a toast. No-ops until the host is mounted. */
export function pushToast(kind: ToastKind, title: string, message?: string) {
  listener?.({ id: nextId++, kind, title, message });
}

function ToastItem({ toast, onDismiss }: { toast: ToastPayload; onDismiss: () => void }) {
  const { theme } = useAppTheme();
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDismiss());
    }, toast.kind === "error" ? 4200 : 2800);

    return () => clearTimeout(timer);
  }, [anim, onDismiss, toast.kind]);

  const accent =
    toast.kind === "success"
      ? theme.success
      : toast.kind === "error"
        ? theme.danger
        : theme.warning;

  const Icon =
    toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertTriangle : Info;

  return (
    <Animated.View
      style={[
        styles.toast,
        shadows.lifted,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />

      <View style={styles.textCol}>
        <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
          {toast.title}
        </Text>
        {toast.message ? (
          <Text numberOfLines={3} style={[styles.message, { color: theme.textMuted }]}>
            {toast.message}
          </Text>
        ) : null}
      </View>

      <Icon size={18} color={accent} />

      <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="סגירה">
        <X size={15} color={theme.textSubtle} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Non-blocking replacement for Alert.alert.
 *
 * Mounted once at the root; `notify` pushes into it rather than interrupting
 * the user with a modal dialog.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = React.useState<ToastPayload[]>([]);

  React.useEffect(() => {
    listener = (toast) => setToasts((prev) => [...prev.slice(-2), toast]);
    return () => {
      listener = null;
    };
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    gap: 8,
    ...(Platform.OS === "web" ? { maxWidth: 430, marginHorizontal: "auto" } : null),
  },
  toast: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 4,
  },
  textCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginTop: 2,
  },
});
