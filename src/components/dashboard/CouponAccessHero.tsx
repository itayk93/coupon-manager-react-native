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
import { Kuponi } from "@/components/ui/Kuponi";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { expiringSoon, homeHeroSummary, topCouponTags } from "@/lib/homeHero";
import { EXPIRY_PERFORMANCE, expiryLevel } from "@/lib/expiryUrgency";

/**
 * The top of the home screen: search, then what is urgent, then shortcuts.
 *
 * This used to open with Kuponi holding the balance across the full width,
 * about 150 points before anything actionable. The reasoning was that the
 * balance is the one number a person opens the app already wondering about —
 * true of someone browsing at home, and wrong about the moment that actually
 * dominates. People open a coupon app standing at a till with a cashier
 * waiting. They know the shop; they need the barcode. Every point spent above
 * the search field and the company rail is a point spent in front of a queue.
 *
 * So the character no longer holds the top of the screen. He appears in one
 * thin strip, and only when something is about to expire — which is the test
 * written down in `docs/mascot/STATE-LAW.md` §3: if he is still on screen when
 * everything is fine, his presence carries no information and stops being read.
 * Now his showing up is itself the message.
 *
 * The balance follows in `WalletSummaryCard`, below the companies. A first
 * pass shrank it to a caption under the search, which is not less prominent,
 * it is gone: people still check that number, and it only reads as worth
 * checking if it is set like it.
 */

/** Tags worth showing as chips before the row starts to read as a list filter. */
const CHIP_TAG_LIMIT = 4;

type CouponAccessHeroProps = {
  coupons: DecryptedCoupon[];
  /** Coupon id → tag names, straight from `useCouponTagsMap`. */
  tagsMap?: Record<number, string[]>;
};

export function CouponAccessHero({ coupons, tagsMap = {} }: CouponAccessHeroProps) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [text, setText] = useState("");
  // `row-reverse` puts the first chip on the right, but the ScrollView still
  // opens at the left edge — which is the end of the row. See `CouponRail`.
  const chips = useRef<ScrollView>(null);

  const summary = useMemo(() => homeHeroSummary(coupons), [coupons]);
  const expiring = useMemo(() => expiringSoon(coupons), [coupons]);
  const tagChips = useMemo(
    () => topCouponTags(coupons, tagsMap).slice(0, CHIP_TAG_LIMIT),
    [coupons, tagsMap]
  );

  const kuponi = EXPIRY_PERFORMANCE[expiryLevel(summary.nearestDays)];

  const openSearch = (query: string) => {
    const trimmed = query.trim();
    Keyboard.dismiss();
    router.push(trimmed ? { pathname: "/coupons", params: { initialSearch: trimmed } } : "/coupons");
  };

  // The at-risk page orders by money on the line and says the total; a
  // filtered coupons list is the same rows with none of that.
  const openExpiring = () => router.push("/at-risk");

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
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

      {/* He turns up only when money is about to disappear, so the fact that he
          is here at all is the message. On a calm wallet this renders nothing. */}
      {summary.linksToExpiring ? (
        <TouchableOpacity
          onPress={openExpiring}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${summary.message}. מעבר לקופונים שפגים בקרוב`}
          style={[styles.urgentStrip, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder }]}
        >
          <ChevronLeft size={15} color={theme.dangerText} />
          <Text style={[styles.urgentText, { color: theme.dangerText }]} numberOfLines={2}>
            {summary.message}
          </Text>
          <View style={styles.urgentMascot} pointerEvents="none">
            <Kuponi state={kuponi.state} speed={kuponi.speed} size={44} />
          </View>
        </TouchableOpacity>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  searchBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 0,
  },
  scanBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  urgentStrip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    // Keeps the strip one height whether the mascot is drawn or still.
    minHeight: 56,
  },
  urgentMascot: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  urgentText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  chipsScroll: { marginTop: 8 },
  chipsRow: { flexDirection: "row-reverse", gap: 8, paddingVertical: 1 },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, writingDirection: "rtl" },
});
