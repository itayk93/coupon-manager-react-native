import React, { useMemo, useState } from "react";
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
import { Search, ScanLine, Flame } from "lucide-react-native";
import { MascotAnimation, type MascotState } from "@/components/ui/MascotAnimation";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useContentWidth } from "@/hooks/useContentWidth";
import { fonts, radii } from "@/lib/theme";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import {
  expiringSoon,
  homeHeroSummary,
  topCouponTags,
  type HomeHeroSummary,
  type HomeMascotState,
} from "@/lib/homeHero";

/**
 * The top of the alternative home screen: one line from the mascot, the search
 * field, and a row of quick filters — in that order and in that little space.
 *
 * The rule this component exists to enforce is that the mascot is the doorman
 * and not the room. Everything here together is about 200pt tall, so the first
 * coupon card still starts on the first screen of a standard iPhone. If a new
 * element wants to live in the hero, something else has to leave.
 *
 * The character comes from the existing `MascotAnimation` atlas rather than a
 * new static asset: the family of 3D renders already covers the four faces this
 * screen needs, and a second source of mascot art is a second thing to keep in
 * sync. It is cropped at the search bar so only the head and the hands clear it
 * — the "peeking over the field" composition, without new art.
 */

/** The four home states, mapped onto the atlas rows that already exist. */
const MASCOT_ROW: Record<HomeMascotState, MascotState> = {
  happy: "talking",
  concerned: "concerned",
  panic: "panic",
  empty: "talking",
};

/** Height the bubble row reserves; the mascot is cropped to it plus the spill. */
const TOP_ROW_HEIGHT = 92;
/** Gap between the bubble row and the search field. */
const SEARCH_GAP = 10;
/** How far the mascot is allowed to lean onto the search field. */
const BAR_OVERLAP = 10;

/** What the mascot says while the wallet is still being fetched. Anything from
 *  `homeHeroSummary` would be a guess: an empty list on the way in looks exactly
 *  like an empty wallet. */
const LOADING_SUMMARY: HomeHeroSummary = {
  state: "happy",
  message: "רגע, בודקים מה יש בארנק…",
  nearestDays: null,
  urgentCount: 0,
  linksToExpiring: false,
};

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

  // Narrow phones give the bubble the room instead of the character; tablets do
  // not get a giant mascot, they get the same one with more text beside it.
  const mascotSize = width < 360 ? 104 : width >= 768 ? 132 : 122;
  const walletSummary = useMemo(() => homeHeroSummary(coupons), [coupons]);
  const summary = isLoading && coupons.length === 0 ? LOADING_SUMMARY : walletSummary;
  const expiringCount = useMemo(() => expiringSoon(coupons).length, [coupons]);
  const tagChips = useMemo(() => topCouponTags(coupons, tagsMap), [coupons, tagsMap]);

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

  const handleBubblePress = () => {
    if (summary.linksToExpiring) {
      openExpiring();
      return;
    }
    if (summary.state === "empty") router.push("/scanner");
  };

  const bubbleBg = summary.state === "panic" ? theme.dangerBg : theme.surfaceAlt;
  const bubbleBorder = summary.state === "panic" ? theme.dangerBorder : theme.cardBorder;
  const bubbleText = summary.state === "panic" ? theme.dangerText : theme.text;

  return (
    <View style={styles.wrap}>
      <View style={[styles.topRow, { height: TOP_ROW_HEIGHT }]}>
        {/* Empty slot: the character itself is painted by the layer below, so
            that it can spill over the search field without being clipped by
            this row. */}
        <View style={{ width: mascotSize }} pointerEvents="none" />

        <TouchableOpacity
          activeOpacity={summary.linksToExpiring || summary.state === "empty" ? 0.8 : 1}
          onPress={handleBubblePress}
          accessibilityRole={summary.linksToExpiring ? "button" : "text"}
          accessibilityLabel={
            summary.linksToExpiring
              ? `${summary.message}. מעבר לקופונים שפגים בקרוב`
              : summary.message
          }
          style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}
        >
          <Text style={[styles.bubbleText, { color: bubbleText }]} numberOfLines={3}>
            {summary.message}
          </Text>
          {summary.linksToExpiring ? (
            <Text style={[styles.bubbleHint, { color: theme.primary }]} numberOfLines={1}>
              להצגת הקופונים ←
            </Text>
          ) : null}
          {/* The tail: a rotated square sharing the bubble's fill and border, so
              it reads as part of the same shape pointing at the character. */}
          <View
            style={[
              styles.bubbleTail,
              { backgroundColor: bubbleBg, borderColor: bubbleBorder },
            ]}
          />
        </TouchableOpacity>
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

      {expiringCount > 0 || tagChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {expiringCount > 0 ? (
            <TouchableOpacity
              onPress={openExpiring}
              style={[
                styles.chip,
                { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`קופונים קרובים לפקיעה, ${expiringCount}`}
            >
              <Flame size={13} color={theme.danger} />
              <Text style={[styles.chipText, { color: theme.dangerText }]}>
                קרוב לפקיעה ({expiringCount})
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Only tags the user actually put on their own coupons. Guessing a
              category from a company name is wrong often enough to be worse
              than showing nothing. */}
          {tagChips.map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() =>
                router.push({ pathname: "/coupons", params: { initialFilterTag: tag } })
              }
              style={[
                styles.chip,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.cardBorder },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`סינון לפי התגית ${tag}`}
            >
              <Text style={[styles.chipText, { color: theme.textSecondary }]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

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
          state={MASCOT_ROW[summary.state]}
          accessibilityLabel="קופי, המאסקוט של קופון מאסטר"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    marginBottom: 14,
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
  bubbleText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },
  bubbleHint: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
  },
  bubbleTail: {
    position: "absolute",
    right: -5,
    top: 26,
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
  mascotLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    overflow: "hidden",
    alignItems: "center",
  },
});
