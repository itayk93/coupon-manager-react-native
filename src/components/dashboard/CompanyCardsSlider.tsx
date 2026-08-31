import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { ShimmerLogo } from "@/components/coupons/ShimmerLogo";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { isFemaleUser } from "@/lib/gender";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAuth } from "@/contexts/AuthContext";
import { fonts, radii, shadows } from "@/lib/theme";

type CompanyCardItem = {
  company: string;
  count: number;
};

type CompanyCardsSliderProps = {
  companyCards: CompanyCardItem[];
  selectedCompany: string | null;
  onSelectCompany: (company: string) => void;
};

/**
 * "חברות עם קופונים פעילים" — a wrapping grid of company tiles, per the
 * redesign (the previous version was a horizontal slider).
 */
export function CompanyCardsSlider({
  companyCards,
  selectedCompany,
  onSelectCompany,
}: CompanyCardsSliderProps) {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const collapsedCount = isTablet ? 10 : 6;
  const [isExpanded, setIsExpanded] = useState(false);

  const isFemale = isFemaleUser(user?.gender);
  const showAllLabel = isFemale ? "הציגי הכול" : "הצג הכול";
  const showLessLabel = isFemale ? "הציגי פחות" : "הצג פחות";

  if (companyCards.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {companyCards.length > collapsedCount ? (
          <TouchableOpacity
            onPress={() => setIsExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
          >
            <Text style={[styles.showAll, { color: theme.textMuted }]}>
              {isExpanded ? showLessLabel : showAllLabel}
            </Text>
          </TouchableOpacity>
        ) : <View />}
        <Text style={[styles.sectionTitle, { color: theme.text }]}> 
          חברות עם קופונים פעילים
        </Text>
      </View>

      <View style={styles.grid}>
        {(isExpanded ? companyCards : companyCards.slice(0, collapsedCount)).map((item) => {
          const isSelected = selectedCompany === item.company;
          const logoUri = getCompanyLogoSource(item.company);

          return (
            <PressableScale
              key={item.company}
              haptic
              accessibilityRole="button"
              accessibilityLabel={item.company}
              onPress={() => onSelectCompany(item.company)}
              style={[
                styles.card,
                isTablet && styles.tabletCard,
                shadows.card,
                {
                  backgroundColor: theme.card,
                  borderColor: isSelected ? theme.primary : "transparent",
                  borderWidth: isSelected ? 2 : 0,
                },
              ]}
            >
              <ShimmerLogo
                source={logoUri}
                size={72}
                style={[styles.logoWrapper, { borderColor: theme.surfaceAlt }]}
                imageStyle={styles.logo}
              />

              <Text numberOfLines={1} style={[styles.companyName, { color: theme.text }]}>
                {item.company}
              </Text>

              <Text style={[styles.couponCount, { color: theme.textSubtle }]}> 
                {item.count === 1 ? "קופון אחד" : `${item.count} קופונים`}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  showAll: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    width: "31%",
    borderRadius: radii.card,
    minHeight: 98,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 5,
  },
  tabletCard: {
    width: "19%",
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "80%",
    height: "80%",
  },
  companyName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "100%",
  },
  couponCount: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
