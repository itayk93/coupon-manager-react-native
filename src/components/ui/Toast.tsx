import { useNativeDriver } from "@/lib/animation";
import React from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

type Listener = (toast: ToastPayload) => void;

let listener: Listener | null = null;
let nextId = 1;

/** Queue a toast. No-ops until the host is mounted. */
export function pushToast(
  kind: ToastKind,
  title: string,
  message?: string,
  options?: Pick<ToastPayload, "actionLabel" | "onAction" | "duration">,
) {
  listener?.({ id: nextId++, kind, title, message, ...options });
}

function ToastItem({ toast, onDismiss }: { toast: ToastPayload; onDismiss: () => void }) {
  const { theme } = useAppTheme();
  const anim = React.useRef(new Animated.Value(0)).current;
  // Drag offset, kept apart from the entrance animation so a swipe can move the
  // card without fighting the fade-in.
  const dragY = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = React.useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => finished && onDismiss());
  }, [anim, onDismiss]);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();

    timer.current = setTimeout(hide, toast.duration ?? (toast.kind === "error" ? 4200 : 2800));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, hide, toast.duration, toast.kind]);

  // Flick the toast up to get rid of it. Upward only: a downward drag is the
  // usual way to scroll the screen behind, and stealing it would be worse than
  // having no gesture at all.
  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          if (timer.current) clearTimeout(timer.current);
        },
        onPanResponderMove: (_e, g) => dragY.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -40 || g.vy < -0.6) {
            Animated.timing(dragY, {
              toValue: -160,
              duration: 150,
              easing: Easing.in(Easing.cubic),
              useNativeDriver,
            }).start(({ finished }) => finished && onDismiss());
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver, bounciness: 6 }).start();
          timer.current = setTimeout(hide, 2500);
        },
      }),
    [dragY, hide, onDismiss],
  );

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
      {...pan.panHandlers}
      accessibilityHint="אפשר להחליק מעלה כדי לסגור"
      style={[
        styles.toast,
        shadows.lifted,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            { translateY: dragY },
          ],
        },
      ]}
    >
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />
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

      {toast.actionLabel && toast.onAction ? (
        <Pressable
          onPress={() => {
            toast.onAction?.();
            onDismiss();
          }}
          accessibilityRole="button"
          style={[styles.action, { backgroundColor: theme.primaryTint }]}
        >
          <Text style={[styles.actionText, { color: theme.primary }]}>{toast.actionLabel}</Text>
        </Pressable>
      ) : null}

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
    <View style={[styles.host, { top: insets.top + 8, pointerEvents: "box-none" }]}>
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
  grabber: {
    position: "absolute",
    top: 4,
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
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
  action: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "800",
  },
});
