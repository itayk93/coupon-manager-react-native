import React from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { radii } from "@/lib/theme";
import { useNativeDriver } from "@/lib/animation";

export function CouponCardSkeleton() {
  const { theme } = useAppTheme();
  const pulse = React.useRef(new Animated.Value(0.45)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const block = { backgroundColor: theme.surfaceAlt, opacity: pulse };
  return (
    <View
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      accessible
      accessibilityLabel="טוען קופון"
    >
      <Animated.View style={[styles.header, block]} />
      <View style={styles.body}>
        <Animated.View style={[styles.amount, block]} />
        <Animated.View style={[styles.line, block]} />
        <Animated.View style={[styles.lineShort, block]} />
        <View style={styles.actions}>
          <Animated.View style={[styles.action, block]} />
          <Animated.View style={[styles.action, block]} />
        </View>
      </View>
    </View>
  );
}

export function CouponDetailsSkeleton() {
  return <View style={styles.details}>{[1, 2, 3].map((item) => <CouponCardSkeleton key={item} />)}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  header: { height: 76 },
  body: { padding: 18, gap: 12 },
  amount: { width: "42%", height: 32, borderRadius: 10, alignSelf: "flex-end" },
  line: { width: "100%", height: 10, borderRadius: 5 },
  lineShort: { width: "62%", height: 14, borderRadius: 7, alignSelf: "flex-end" },
  actions: { flexDirection: "row-reverse", gap: 10 },
  action: { flex: 1, height: 48, borderRadius: 12 },
  details: { padding: 16 },
});
