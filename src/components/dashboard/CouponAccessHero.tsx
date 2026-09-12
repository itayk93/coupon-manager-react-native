import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Flame, Plus, ScanLine, Search } from "lucide-react-native";
import { MascotAnimation, type MascotState } from "@/components/ui/MascotAnimation";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useContentWidth } from "@/hooks/useContentWidth";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { isSpendableCoupon, totalRemainingValue } from "@/lib/couponTotals";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import {
  expiringSoon,
  homeHeroSummary,
  topCouponTags,
  type HomeMascotState,
} from "@/lib/homeHero";

/**
 * The top of the home screen: the mascot holding up what is left in the wallet,
 * the search field, and a row of things to do.
 *
 * The balance is the mascot's line, not a card of its own further down. It is
 * the one number a person opens this app already wondering about, and putting
 * it in the speech bubble is what makes the character useful rather than
 * decorative — he is holding your money, and then telling you which of it is
 * about to expire.
 *
 * Everything here together stays around 250pt so the first coupon rail is on
 * screen without scrolling. The character comes from the existing
 * `MascotAnimation` atlas — no new art — cropped at the search field so only
 * the head and hands clear it.
 */

/** The four home states, mapped onto the atlas rows that already exist. */
const MASCOT_ROW: Record<HomeMascotState, MascotState> = {
  happy: "talking",
  concerned: "concerned",
  panic: "panic",
  empty: "talking",
};

/** Height the bubble row reserves; the mascot is cropped to it plus the spill. */
const TOP_ROW_HEIGHT = 132;
/** Gap between the bubble row and the search field. */
const SEARCH_GAP = 10;
/** How far the mascot is allowed to lean onto the search field. */
const BAR_OVERLAP = 10;

type CouponAccessHeroProps = {
  coupons: DecryptedCoupon[];
  /** Coupon id → tag names, straight from `useCouponTagsMap`. */
  tagsMap?: Record<number, string[]>;
  isLoading?: boolean;
};

export function CouponAccessHero({ coupons, tagsMap = {}, isLoading }: CouponAccessHeroProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const width = useContentWidth();
  const [text, setText] = useState("");
  // `row-reverse` puts the first chip on the right, but the ScrollView still
  // opens at the left edge — which is the end of the row. See `CouponRail`.
  const chips = useRef<ScrollView>(null);

  // Narrow phones give the bubble the room instead of the character; tablets do
  // not get a giant mascot, they get the same one with more text beside it.
  const mascotSize = width < 360 ? 104 : width >= 768 ? 132 : 122;
  const summary = useMemo(() => homeHeroSummary(coupons), [coupons]);
  const expiring = useMemo(() => expiringSoon(coupons), [coupons]);
  const tagChips = useMemo(() => topCouponTags(coupons, tagsMap), [coupons, tagsMap]);
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

  const openExpiring = () =>
    router.push({ pathname: "/coupons", params: { initialStatus: "expiring" } });

  const waiting = isLoading && coupons.length === 0;
  const empty = !waiting && summary.state === "empty";
  const mascotState: HomeMascotState = waiting ? "happy" : summary.state;

  return (
    <View style={styles.wrap}>
      <View style={[styles.topRow, { minHeight: TOP_ROW_HEIGHT }]}>
        {/* Empty slot: the character itself is painted by the layer below, so it
            can spill over the search field without being clipped by this row. */}
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

      {/* Things to do, not only ways to filter — a row of filters alone reads as
          the top of a list screen. */}
      <ScrollView
        ref={chips}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => chips.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <TouchableOpacity
          onPress={() => router.push("/coupons/add")}
          style={[styles.chip, { backgroundColor: theme.primaryTint, borderColor: theme.primaryMuted }]}
          accessibilityRole="button"
        >
          <Plus size={13} color={theme.primary} />
          <Text style={[styles.chipText, { color: theme.primary }]}>הוספת קופון</Text>
        </TouchableOpacity>

        {expiring.length > 0 ? (
          <TouchableOpacity
            onPress={openExpiring}
            style={[styles.chip, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}
            accessibilityRole="button"
            accessibilityLabel={`קופונים קרובים לפקיעה, ${expiring.length}`}
          >
            <Flame size={13} color={theme.danger} />
            <Text style={[styles.chipText, { color: theme.dangerText }]}>
              קרוב לפקיעה ({expiring.length})
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Only tags the user actually put on their own coupons. Guessing a
            category from a company name is wrong often enough to be worse than
            showing nothing. */}
        {tagChips.map((tag) => (
          <TouchableOpacity
            key={tag}
            onPress={() => router.push({ pathname: "/coupons", params: { initialFilterTag: tag } })}
            style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel={`סינון לפי התגית ${tag}`}
          >
            <Text style={[styles.chipText, { color: theme.textSecondary }]}>#{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Painted last so it can lean on the field, and cropped by its own box so
          only the part above the crop line shows. */}
      <View
        style={[
          styles.mascotLayer,
          { width: mascotSize, height: TOP_ROW_HEIGHT + SEARCH_GAP + BAR_OVERLAP },
        ]}
        pointerEvents="none"
      >
        <MascotAnimation
          size={mascotSize}
          state={MASCOT_ROW[mascotState]}
          accessibilityLabel={
            waiting || empty
              ? "קופי, המאסקוט של קופון מאסטר"
              : `קופי מחזיק ${formatIls(remaining)}`
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
  chipsScroll: {
    marginHorizontal: -4,
    marginTop: 10,
  },
  chipsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  /**
   * The character's box starts at the top of the bubble row and ends a little
   * way into the search field. He is aligned to the *bottom* of it, so he
   * leans on the field however tall the bubble happens to be, and the box
   * crops anything that would spill further down the screen.
   */
  mascotLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
