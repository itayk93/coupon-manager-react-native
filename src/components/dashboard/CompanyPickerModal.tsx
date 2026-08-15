import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
} from "react-native";
import { Search, Plus } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { getCompanyLogo } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";

const POPULAR_COMPANIES = [
  "BuyMe",
  "Carrefour",
  "קרפור",
  "מגה ספורט",
  "XTRA",
  "אקסטרה",
  "Dream Card",
  "Power Gift",
  "GoodPharm",
  "גוד פארם",
  "פולגת",
  "פוקס הום",
  "גולדה",
  "Wolt",
  "וולט",
  "רולדין",
  "רמי לוי",
  "שופרסל",
  "סינמה סיטי",
  "הוט סינמה",
  "דומינוס פיצה",
  "פיצה האט",
  "מקדונלדס",
  "בורגר קינג",
  "בנדיקט",
  "נופשונית פלוס",
  "קפה עלית",
  "ללין",
  "א.ל.מ.",
  "ארקפה",
  "ארקיע",
  "פאפא ג'ונס",
  "מפעל הפיס",
  "ריבר",
  "שובר מסעדות",
  "תו פלוס",
];

type CompanyPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (company: string) => void;
};

export function CompanyPickerModal({
  visible,
  onClose,
  onSelect,
}: CompanyPickerModalProps) {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState("");

  const filtered = POPULAR_COMPANIES.filter((comp) =>
    comp.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelect = (companyName: string) => {
    onSelect(companyName);
    onClose();
  };

  const handleCreateCustom = () => {
    if (search.trim()) {
      handleSelect(search.trim());
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="בחירת חברה / מותג">
      <View style={styles.container}>
        {/* Search Input */}
        <View
          style={[
            styles.searchWrapper,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.border,
            },
          ]}
        >
          <Search size={18} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="חיפוש או הזנת שם חברה..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {search.trim().length > 0 && !filtered.includes(search.trim()) ? (
          <TouchableOpacity
            onPress={handleCreateCustom}
            style={[
              styles.customCompanyBtn,
              {
                backgroundColor: theme.primaryMuted,
                borderColor: theme.primary,
              },
            ]}
          >
            <Text style={[styles.customCompanyText, { color: theme.primary }]}>
              השתמש ב- "{search.trim()}"
            </Text>
            <Plus size={18} color={theme.primary} />
          </TouchableOpacity>
        ) : null}

        {/* List of Companies */}
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(item) => item}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const logo = getCompanyLogo(item);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSelect(item)}
                style={[
                  styles.companyItem,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.logoBox}>
                  <Image
                    source={{ uri: logo }}
                    style={styles.logoImg}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.itemText, { color: theme.text }]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  searchWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    textAlign: "right",
  },
  customCompanyBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  customCompanyText: {
    fontSize: 14,
    fontWeight: "700",
  },
  grid: {
    gap: 10,
  },
  companyItem: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    margin: 4,
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: "100%",
    height: "100%",
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
});
