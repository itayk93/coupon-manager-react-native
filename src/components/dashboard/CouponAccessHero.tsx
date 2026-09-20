import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Flame, ScanLine, Search } from "lucide-react-native";
import { MascotAnimation, type MascotState } from "@/components/ui/MascotAnimation";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import { fonts, radii } from "@/lib/theme";
import { EXPIRY_PERFORMANCE, expiryLevel } from "@/lib/expiryUrgency";
import { formatIls } from "@/lib/formatIls";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { homeHeroSummary, type HomeMascotState } from "@/lib/homeHero";

/**
 * The top of the home screen: the mascot holding up what is left in the wallet,
 * and the search field under him.
 *
 * The balance is the mascot's line, not a card of its own further down. It is
 * the one number a person opens this app already wondering about, and putting
 * it in the speech bubble is what makes the character useful rather than
 * decorative — he is holding your money, and then telling you which of it is
 * about to expire.
 *
 * A row of chips used to sit under the field — add a coupon, what is expiring,
 * the user's own tags. Adding a coupon is the screen's one standing action and
 * now has the button in the bottom corner, where a thumb reaches it from
 * anywhere on the page; the other two were a second way to somewhere the
 * bubble and the stat tiles already go. A row of shortcuts under a search
 * field reads as the top of a list screen either way.
 *
 * Everything here together stays around 250pt so the first coupon card is on
 * screen without scrolling. The character comes from the existing
 * `MascotAnimation` atlas — no new art — centred in a box the height of the
 * bubble, so he is level with the balance rather than down on the search
 * field.
 */

/** The four home states, mapped onto the atlas rows that already exist. */
const MASCOT_ROW: Record<HomeMascotState, MascotState> = {
  happy: "talking",
  concerned: "concerned",
  panic: "concerned",
  empty: "talking",
};

/**
 * Height the bubble row reserves before it is measured, and the floor it never
 * goes below. The real height is measured, because the bubble grows: a wallet
 * with something expiring adds an urgent line, and a long company name wraps
 * it to two. It is also the mascot's box, so whatever the bubble grew to, he
 * stays centred against it instead of hanging in the air.
 */
const TOP_ROW_HEIGHT = 132;
/** Gap between the bubble row and the search field. */
const SEARCH_GAP = 10;

type CouponAccessHeroProps = {
  coupons: DecryptedCoupon[];
  isLoading?: boolean;
};

export function CouponAccessHero({ coupons, isLoading }: CouponAccessHeroProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { width, isTablet } = useResponsive();
  const [text, setText] = useState("");
  // The measured height of the bubble row, which is also the mascot's box: he
  // is centred in it, so however tall the bubble grew, he stays level with its
  // middle.
  const [topRowHeight, setTopRowHeight] = useState(TOP_ROW_HEIGHT);

  // Narrow phones give the bubble the room instead of the character; tablets do
  // not get a giant mascot, they get the same one with more text beside it.
  const mascotSize = width < 360 ? 104 : isTablet ? 132 : 122;
  const summary = useMemo(() => homeHeroSummary(coupons), [coupons]);
  const remaining = useMemo(() => totalRemainingValue(coupons), [coupons]);
  const spendableCount = useMemo(() => coupons.filter(isSpendableCoupon).length, [coupons]);

  const openSearch = (query: string) => {
    const trimmed = query.trim();
    Keyboard.dismiss();
    if (!trimmed) {
      router.push("/coupons");
      return;
    }
    router.push({ pathname: "/coupons", params: { initialSearch: trimmed } });
  };

  // The at-risk page orders by money on the line and says the total; a
  // filtered coupons list is the same rows with none of that.
  const openExpiring = () => router.push("/at-risk");

  const waiting = isLoading && coupons.length === 0;
  const empty = !waiting && summary.state === "empty";
  const mascotState: HomeMascotState = waiting ? "happy" : summary.state;
  // He keeps the greeting loop while he is presenting the balance; only how
  // hard he plays it tracks the deadline. See `EXPIRY_PERFORMANCE`.
  const mascotSpeed = waiting ? 1 : EXPIRY_PERFORMANCE[expiryLevel(summary.nearestDays)].speed;

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.topRow, { minHeight: TOP_ROW_HEIGHT }]}
        onLayout={(event) => {
          const measured = Math.round(event.nativeEvent.layout.height);
          // Guarded: onLayout fires on every re-render, and setting state
          // unconditionally would loop.
          setTopRowHeight((current) => (current === measured ? current : measured));
        }}
      >
        {/* Empty slot: it holds the character's width open in the row, while the
            character himself is painted by the absolutely positioned layer
            below, whose own height is what decides how high he stands. */}
        <View style={{ width: mascotSize }} pointerEvents="none" />

        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.surfaceAlt, borderColor: theme.cardBorder },
          ]}
        >
          {waiting ? (
            <Text style={[styles.waiting, { color: theme.textMuted }]}>
              רגע, בודקים מה יש בארנק…
            </Text>
          ) : empty ? (
            <>
              <Text style={[styles.emptyLine, { color: theme.text }]}>
                {summary.message}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/scanner")}
                style={styles.linkRow}
                accessibilityRole="button"
              >
                <ChevronLeft size={15} color={theme.primary} />
                <Text style={[styles.linkText, { color: theme.primary }]}>הוספת קופון</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* The number first: it is what the screen is being opened for. */}
              <Text
                style={[styles.amount, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatIls(remaining)}
              </Text>
              <Text style={[styles.amountCaption, { color: theme.textMuted }]} numberOfLines={1}>
                {spendableCount === 1 ? "נשאר לך בקופון אחד" : `נשארו לך ב-${spendableCount} קופונים`}
              </Text>

              {summary.linksToExpiring ? (
                <TouchableOpacity
                  onPress={openExpiring}
                  style={[styles.urgentRow, { borderTopColor: theme.cardBorder }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${summary.message}. מעבר לקופונים שפגים בקרוב`}
                >
                  <ChevronLeft size={14} color={theme.dangerText} />
                  <Text style={[styles.urgentText, { color: theme.dangerText }]} numberOfLines={2}>
                    {summary.message}
                  </Text>
                  <Flame size={13} color={theme.danger} />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.calmText, { color: theme.textMuted }]} numberOfLines={2}>
                  {summary.message}
                </Text>
              )}
            </>
          )}

          {/* The tail: a rotated square sharing the bubble's fill and border, so
              it reads as part of the same shape pointing at the character. */}
          <View
            style={[
              styles.bubbleTail,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.cardBorder },
            ]}
          />
        </View>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginTop: SEARCH_GAP },
        ]}
      >
        <TouchableOpacity
          onPress={() => openSearch(text)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="חיפוש קופונים"
        >
          <Search size={18} color={theme.textMuted} />
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => openSearch(text)}
          returnKeyType="search"
          placeholder="חפש קופון, מותג או מקום..."
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
          accessibilityLabel="חיפוש קופון, מותג או מקום"
        />
        <TouchableOpacity
          onPress={() => router.push("/scanner")}
          style={[styles.scanBtn, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel="סריקת קופון חדש"
        >
          <ScanLine size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Painted last so it sits over the empty slot, and centred inside a box
          as tall as the bubble row, so he lines up with the middle of the
          bubble rather than with its foot. He started out 20pt below it,
          leaning onto the search field, which read as him sliding off the
          bottom of the screen rather than presenting the balance. */}
      <View
        style={[styles.mascotLayer, { width: mascotSize, height: topRowHeight }]}
        pointerEvents="none"
      >
        <MascotAnimation
          size={mascotSize}
          state={MASCOT_ROW[mascotState]}
          speed={mascotSpeed}
          accessibilityLabel={
            waiting || empty
              ? "קופוני"
              : `קופוני מחזיק ${formatIls(remaining)}`
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  bubble: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "flex-end",
  },
  amount: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    textAlign: "right",
    alignSelf: "stretch",
  },
  amountCaption: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  urgentRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "flex-start",
    gap: 6,
    borderTopWidth: 1,
    marginTop: 9,
    paddingTop: 8,
  },
  urgentText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "right",
    writingDirection: "rtl",
  },
  calmText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "right",
    writingDirection: "rtl",
    alignSelf: "stretch",
  },
  emptyLine: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
    textAlign: "right",
    writingDirection: "rtl",
    alignSelf: "stretch",
  },
  waiting: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: "right",
    writingDirection: "rtl",
    alignSelf: "stretch",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 8,
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
  },
  bubbleTail: {
    position: "absolute",
    right: -5,
    top: 28,
    width: 12,
    height: 12,
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
  searchBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: fonts.body,
    fontSize: 14.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  scanBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * The character's box is the bubble row, and he is centred in it, so his
   * middle sits level with the bubble's middle however tall the bubble
   * happens to be. He was aligned to the bottom of the box before, which on
   * a bubble taller than he is left him sitting low beside it with his head
   * below the balance he is meant to be presenting. Centred, he also lands
   * nearer the bubble's tail, which is pinned to the top of the bubble.
   *
   * The rise is the bubble's own doing: a calm wallet's bubble is barely
   * taller than he is and he hardly moves, while one carrying the balance,
   * the caption and an urgent line lifts him by half the difference.
   */
  mascotLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
