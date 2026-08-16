import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
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

  if (companyCards.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        חברות עם קופונים פעילים
      </Text>

      <View style={styles.grid}>
        {companyCards.map((item) => {
          const isSelected = selectedCompany === item.company;
          const logoUri = getCompanyLogo(item.company);

          return (
            <TouchableOpacity
              key={item.company}
              activeOpacity={0.8}
              onPress={() => onSelectCompany(item.company)}
              style={[
                styles.card,
                shadows.card,
                {
                  backgroundColor: theme.card,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <View style={[styles.logoWrapper, { borderColor: theme.surfaceAlt }]}>
                <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
              </View>

              <Text numberOfLines={1} style={[styles.companyName, { color: theme.text }]}>
                {item.company}
              </Text>

              <Text style={[styles.couponCount, { color: theme.textSubtle }]}>
                {item.count} קופונים
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    // Two per row on a phone, matching the design's minmax(140px, 1fr) grid.
    width: "48%",
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  logoWrapper: {
    width: 52,
    height: 52,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "78%",
    height: "78%",
  },
  companyName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "100%",
  },
  couponCount: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
