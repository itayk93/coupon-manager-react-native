import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { X } from "lucide-react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: number | string;
};

/**
 * Shared bottom sheet.
 *
 * The scrim and the sheet animate separately, the same way `CompanySheet`
 * does: `animationType="slide"` would translate the whole modal, dragging the
 * dim backdrop up from the bottom with it. Here the backdrop only fades its
 * opacity while the sheet translates, which is how a native sheet behaves.
 */
export function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: ModalProps) {
  const { theme } = useAppTheme();

  // Stays mounted through the exit animation, otherwise the sheet would vanish
  // instantly instead of sliding out.
  const [mounted, setMounted] = React.useState(visible);
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const drag = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  // Only the handle and header drag the sheet, so the body keeps its scrolling.
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_evt, g) => {
          if (g.dy > 0) drag.setValue(g.dy);
        },
        onPanResponderRelease: (_evt, g) => {
          if (g.dy > 120 || g.vy > 0.8) {
            onClose();
            drag.setValue(0);
          } else {
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }).start();
          }
        },
      }),
    [drag, onClose]
  );

  const enterY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });
  const translateY = Animated.add(enterY, drag);

  if (!mounted) return null;

  return (
    <RNModal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <TouchableOpacity
            style={styles.scrimTouch}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              transform: [{ translateY }],
            },
          ]}
        >
          <SafeAreaView>
            <View {...panResponder.panHandlers}>
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
              </View>

              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <X size={18} color={theme.text} />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                  {title ? (
                    <Text
                      style={[
                        styles.title,
                        { color: theme.text, textAlign: "right" },
                      ]}
                    >
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text
                      style={[
                        styles.subtitle,
                        { color: theme.textMuted, textAlign: "right" },
                      ]}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>

            {footer ? (
              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                {footer}
              </View>
            ) : null}
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  scrimTouch: {
    flex: 1,
  },
  sheet: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    maxHeight: "90%",
    minHeight: "40%",
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    maxHeight: 480,
  },
  bodyContent: {
    padding: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
});
