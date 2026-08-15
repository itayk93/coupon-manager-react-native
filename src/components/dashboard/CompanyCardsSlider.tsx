import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
} from "react-native";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";

type CompanyCardItem = {
  company: string;
  count: number;
};

type CompanyCardsSliderProps = {
  companyCards: CompanyCardItem[];
  selectedCompany: string | null;
  onSelectCompany: (company: string) => void;
};

export function CompanyCardsSlider({
  companyCards,
  selectedCompany,
  onSelectCompany,
}: CompanyCardsSliderProps) {
  const { theme } = useAppTheme();

  if (companyCards.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          קופונים לפי חברה
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
          לחץ לצפייה בקופוני החברה
        </Text>
      </View>

      <FlatList
        data={companyCards}
        horizontal
        inverted // RTL scrolling
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.company}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selectedCompany === item.company;
          const logoUri = getCompanyLogo(item.company);

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onSelectCompany(item.company)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.card,
                  borderColor: isSelected ? theme.primary : theme.cardBorder,
                  borderWidth: isSelected ? 2 : 1,
                  shadowColor: theme.isDark ? "#000" : "#64748b",
                },
              ]}
            >
              <View
                style={[
                  styles.logoWrapper,
                  { backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc" },
                ]}
              >
                <Image
                  source={{ uri: logoUri }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text
                numberOfLines={1}
                style={[styles.companyName, { color: theme.text }]}
              >
                {item.company}
              </Text>

              <Text
                style={[styles.couponCount, { color: theme.primary }]}
              >
                {item.count} קופונים
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  card: {
    width: 125,
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logoWrapper: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    padding: 6,
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  companyName: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
    maxWidth: "100%",
  },
  couponCount: {
    fontSize: 11,
    fontWeight: "600",
  },
});
