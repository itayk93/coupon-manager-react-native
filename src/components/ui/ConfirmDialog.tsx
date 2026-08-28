import { useNativeDriver } from "@/lib/animation";
import React from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";

export type ConfirmRequest = {
  id: number;
  title: string;
  message: string;
  confirmText: string;
  destructive: boolean;
  onConfirm: () => void;
};

type Listener = (req: ConfirmRequest) => void;

let listener: Listener | null = null;
let nextId = 1;

/** Queue a confirm dialog. No-ops until the host is mounted. */
export function pushConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "אישור",
  destructive = true
) {
  listener?.({ id: nextId++, title, message, confirmText, destructive, onConfirm });
}

/**
 * RTL confirmation dialog.
 *
 * Replaces Alert.alert everywhere: the native dialog renders its buttons
 * left-to-right with English system labels ("OK"/"Cancel"), and is a silent
 * no-op on web.
 */
export function ConfirmHost() {
  const { theme } = useAppTheme();
  const [req, setReq] = React.useState<ConfirmRequest | null>(null);
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    listener = (next) => setReq(next);
    return () => {
      listener = null;
    };
  }, []);

  // Keep the last request (and the modal itself) alive through the exit
  // animation, otherwise the dialog is unmounted on the same frame it closes
  // and the fade-out never gets to play.
  const [shown, setShown] = React.useState<ConfirmRequest | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (req) {
      setShown(req);
      setMounted(true);
    }
    Animated.timing(anim, {
      toValue: req ? 1 : 0,
      duration: req ? 180 : 140,
      easing: req ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished && !req) setMounted(false);
    });
  }, [req, anim]);

  const close = () => setReq(null);

  const accept = () => {
    const fn = req?.onConfirm;
    setReq(null);
    fn?.();
  };

  if (!mounted || !shown) return null;

  const accent = shown.destructive ? theme.danger : theme.primary;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            shadows.lifted,
            {
              backgroundColor: theme.card,
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>{shown.title}</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{shown.message}</Text>

          {/* row-reverse: the confirming action sits on the right, where Hebrew starts. */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={accept}
              activeOpacity={0.85}
              style={[styles.btn, { backgroundColor: accent }]}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>{shown.confirmText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={close}
              activeOpacity={0.85}
              style={[styles.btn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.btnText, { color: theme.label }]}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.sheet,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 8,
    marginBottom: 22,
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    fontWeight: "700",
  },
  btnTextPrimary: {
    color: "#ffffff",
  },
});
