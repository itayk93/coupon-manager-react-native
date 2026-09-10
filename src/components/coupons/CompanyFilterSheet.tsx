import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput } from "react-native";
import { Search, Check, LayoutGrid } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { companyKey } from "@/lib/companyName";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts } from "@/lib/theme";

export type CompanyFilterEntry = { name: string; count: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The user's own companies. Rendered in the order given. */
  companies: CompanyFilterEntry[];
  selected: string | null;
  onSelect: (company: string | null) => void;
};

/**
 * The long tail of the company filter. The chip row keeps the few most-used
 * companies inline; everything else lives here in a searchable vertical list so
 * the row never grows past one line.
 */
export function CompanyFilterSheet({ visible, onClose, companies, selected, onSelect }: Props) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("he-IL");
    if (!q) return companies;
    return companies.filter((entry) => entry.name.toLocaleLowerCase("he-IL").includes(q));
  }, [companies, query]);

  const pick = (company: string | null) => {
    onSelect(company);
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="סינון לפי חברה" expandable>
      <View
        style={[styles.searchWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
      >
        <Search size={18} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חיפוש חברה..."
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <TouchableOpacity
        onPress={() => pick(null)}
        style={[styles.row, { borderColor: theme.border }]}
      >
        <View style={[styles.logoBox, { backgroundColor: theme.surfaceAlt }]}>
          <LayoutGrid size={18} color={theme.textMuted} />
        </View>
        <Text style={[styles.name, { color: theme.text }]}>כל החברות</Text>
        {selected === null ? <Check size={18} color={theme.primary} /> : null}
      </TouchableOpacity>

      {filtered.map((entry) => {
        const isCurrent = companyKey(selected) === companyKey(entry.name);
        return (
          <TouchableOpacity
            key={entry.name}
            onPress={() => pick(isCurrent ? null : entry.name)}
            style={[styles.row, { borderColor: theme.border }]}
          >
            <View style={[styles.logoBox, { backgroundColor: theme.surfaceAlt }]}>
              <Image
                source={getCompanyLogoSource(entry.name)}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
              {entry.name}
            </Text>
            <Text style={[styles.count, { color: theme.textMuted }]}>{entry.count}</Text>
            {isCurrent ? <Check size={18} color={theme.primary} /> : null}
          </TouchableOpacity>
        );
      })}

      {filtered.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>לא נמצאה חברה</Text>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    textAlign: "right",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: "100%", height: "100%" },
  name: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  count: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },
});
