import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, Platform } from 'react-native';

/** Confirmed-save feedback only. A failed or pending request never increments sequence. */
export function SavedFeedback({ sequence, color = '#226953' }: { sequence: number; color?: string }) {
  const fill = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = useState<boolean | null>(null);
  const previous = useRef(0);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);
  useEffect(() => {
    if (reduced === null) return;
    if (!sequence) { fill.setValue(0); settle.setValue(1); previous.current = sequence; return; }
    if (previous.current === sequence) {
      if (reduced) { fill.setValue(1); settle.setValue(1); }
      return;
    }
    previous.current = sequence;
    fill.stopAnimation(); settle.stopAnimation();
    if (reduced) { fill.setValue(1); settle.setValue(1); return; }
    fill.setValue(0); settle.setValue(1);
    const motion = Animated.sequence([
      Animated.timing(fill, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.sequence([
        Animated.timing(settle, { toValue: 1.08, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(settle, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ]);
    motion.start();
    return () => motion.stop();
  }, [sequence, reduced, fill, settle]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.box}>
    <Animated.View style={[styles.box, { transform: [{ scale: settle }] }]}>
      <View style={[styles.outline, { borderColor: color }]} />
      <Animated.View style={[styles.disc, { backgroundColor: color, transform: [{ scale: fill }] }]} />
      <Animated.View style={{ opacity: fill }}><View style={styles.check} /></Animated.View>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  check: { width: 7, height: 12, borderColor: '#ffffff', borderRightWidth: 2.5, borderBottomWidth: 2.5, transform: [{rotate: '40deg'}], marginTop: -3 },
  box: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  outline: { position: 'absolute', width: 25, height: 25, borderRadius: 13, borderWidth: 1.5 },
  disc: { position: 'absolute', width: 25, height: 25, borderRadius: 13 },
});
