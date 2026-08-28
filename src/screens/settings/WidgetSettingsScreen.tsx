import { useNativeDriver } from "@/lib/animation";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { ChevronDown, ChevronUp, LayoutGrid, Minus, Plus } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCoupons, useUpdateCoupon, type DecryptedCoupon } from "@/hooks/useCoupons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { notify } from "@/lib/notify";
import { fonts, radii } from "@/lib/theme";
import { couponRemainingValue } from "@/lib/couponTotals";
import {
  MAX_WIDGET_COUPONS,
  isInWidget,
  isWidgetEligible,
  isWidgetFull,
  nextWidgetOrder,
  widgetSelection,
} from "@/lib/widgetSelection";

function WidgetLoadingState() {
  const { theme } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = useRef([
    new Animated.Value(0.25),
    new Animated.Value(0.25),
    new Animated.Value(0.25),
  ]).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver }),
      ])
    );
    const dotsAnimation = Animated.loop(
      Animated.stagger(
        180,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 360, useNativeDriver }),
            Animated.timing(dot, { toValue: 0.25, duration: 360, useNativeDriver }),
          ])
        )
      )
    );

    pulseAnimation.start();
    dotsAnimation.start();

    return () => {
      pulseAnimation.stop();
      dotsAnimation.stop();
    };
  }, [dots, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });

  return (
    <View
      accessibilityLabel="טוען ומכין את הקופונים לווידג'ט"
      accessibilityRole="progressbar"
      style={styles.loadingContainer}
    >
      <Animated.View
        style={[
          styles.loadingIcon,
          { backgroundColor: theme.primaryTint, opacity: pulse, transform: [{ scale }] },
        ]}
      >
        <LayoutGrid size={34} color={theme.primary} />
      </Animated.View>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingTitle, { color: theme.text }]}>טוען ומכין את הקופונים</Text>
      <View style={styles.loadingDots} accessible={false}>
        {dots.map((opacity, index) => (
          <Animated.View
            key={index}
            style={[styles.loadingDot, { backgroundColor: theme.primary, opacity }]}
          />
        ))}
      </View>
      <Text style={[styles.loadingSubtitle, { color: theme.textMuted }]}>זה עשוי לקחת כמה רגעים</Text>
    </View>
  );
}

export function WidgetSettingsScreen() {
  const { theme } = useAppTheme();
  const { data: coupons = [], isLoading } = useCoupons();
  const updateCoupon = useUpdateCoupon();

  const eligible = coupons.filter(isWidgetEligible);
  const selected = widgetSelection(coupons);
  const available = eligible.filter((coupon) => !isInWidget(coupon));
  const isFull = isWidgetFull(coupons);

  const add = (coupon: DecryptedCoupon) => {
    if (isFull) {
      notify.error(`ניתן לבחור עד ${MAX_WIDGET_COUPONS} קופונים`);
      return;
    }
    updateCoupon.mutate({
      id: coupon.id,
      updates: { show_in_widget: true, widget_display_order: nextWidgetOrder(coupons) },
    });
  };

  const remove = (coupon: DecryptedCoupon) => {
    updateCoupon.mutate({
      id: coupon.id,
      updates: { show_in_widget: false, widget_display_order: null },
    });
    // Close the gap so the remaining cards keep a contiguous 0..n-1 order.
    selected
      .filter((other) => other.id !== coupon.id)
      .forEach((other, index) => {
        if ((other.widget_display_order ?? 999) !== index) {
          updateCoupon.mutate({ id: other.id, updates: { widget_display_order: index } });
        }
      });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    updateCoupon.mutate({ id: selected[index].id, updates: { widget_display_order: target } });
    updateCoupon.mutate({ id: selected[target].id, updates: { widget_display_order: index } });
  };

  const renderRow = (
    coupon: DecryptedCoupon,
    action: React.ReactNode,
    reorder?: React.ReactNode
  ) => (
    <View
      key={coupon.id}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primaryTint }]}>
        <Text style={[styles.avatarText, { color: theme.primary }]}>
          {coupon.company.slice(0, 1)}
        </Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {coupon.company}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
          נותרו {Math.round(couponRemainingValue(coupon))} ₪
        </Text>
      </View>

      {reorder}
      {action}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="ווידג'ט מסך הבית" />
        <WidgetLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="ווידג'ט מסך הבית" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.intro, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <LayoutGrid size={20} color={theme.primary} />
          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: theme.text }]}>
              בחר עד {MAX_WIDGET_COUPONS} קופונים להצגה בווידג'ט
            </Text>
            <Text style={[styles.introSubtitle, { color: theme.textMuted }]}>
              {selected.length}/{MAX_WIDGET_COUPONS} קופונים נבחרו
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>קופונים בווידג'ט</Text>
        {selected.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSubtle }]}>עדיין לא נבחרו קופונים</Text>
        ) : (
          selected.map((coupon, index) =>
            renderRow(
              coupon,
              <TouchableOpacity
                accessibilityLabel={`הסר את ${coupon.company} מהווידג'ט`}
                onPress={() => remove(coupon)}
                style={[styles.actionButton, { backgroundColor: theme.dangerBg }]}
              >
                <Minus size={18} color={theme.danger} />
              </TouchableOpacity>,
              <View style={styles.reorder}>
                <TouchableOpacity
                  accessibilityLabel="הזז למעלה"
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                >
                  <ChevronUp size={18} color={index === 0 ? theme.textSubtle : theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="הזז למטה"
                  disabled={index === selected.length - 1}
                  onPress={() => move(index, 1)}
                >
                  <ChevronDown
                    size={18}
                    color={index === selected.length - 1 ? theme.textSubtle : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )
          )
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>קופונים זמינים</Text>
        {available.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={28} color={theme.textSubtle} />}
            title="כל הקופונים הפעילים כבר נבחרו"
            subtitle="הסר קופון מהווידג'ט כדי לפנות מקום לאחר."
          />
        ) : (
          available.map((coupon) =>
            renderRow(
              coupon,
              <TouchableOpacity
                accessibilityLabel={`הוסף את ${coupon.company} לווידג'ט`}
                disabled={isFull}
                onPress={() => add(coupon)}
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.background, opacity: isFull ? 0.4 : 1 },
                ]}
              >
                <Plus size={18} color={theme.primary} />
              </TouchableOpacity>
            )
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 72,
  },
  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  loadingTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    textAlign: "center",
    marginTop: 16,
  },
  loadingDots: { flexDirection: "row", gap: 7, marginTop: 12 },
  loadingDot: { width: 7, height: 7, borderRadius: 4 },
  loadingSubtitle: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: 12 },
  content: { padding: 16, paddingBottom: 120, gap: 8 },
  intro: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  introText: { flex: 1, gap: 2 },
  introTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right" },
  introSubtitle: { fontFamily: fonts.body, fontSize: 13, textAlign: "right" },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    marginTop: 16,
    marginBottom: 4,
    textAlign: "right",
  },
  hint: { fontFamily: fonts.body, fontSize: 13, paddingVertical: 8, textAlign: "right" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, textAlign: "right" },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  reorder: { gap: 2 },
  actionButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
