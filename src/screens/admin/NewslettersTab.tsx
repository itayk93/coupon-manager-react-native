import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Mail, Plus, Trash2, Pencil } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { Newsletter } from "@/integrations/supabase";
import {
  useNewsletters,
  useUpsertNewsletter,
  useDeleteNewsletter,
} from "@/hooks/useAdminManagement";

/**
 * Newsletter authoring for admins - list, create, edit, delete.
 *
 * Sending is deliberately NOT wired here. useSendNewsletter (src/hooks/useEmail.ts)
 * exists and hits the send-emails Edge Function; this screen never imports it.
 * Drafts are reviewed and sent by hand, outside the app.
 */

type Draft = Partial<Newsletter> & { id?: number; title: string };

const EMPTY: Draft = {
  title: "",
  main_title: "",
  content: "",
  custom_html: "",
  newsletter_type: "general",
  show_telegram_button: false,
};

export function NewslettersTab() {
  const { theme } = useAppTheme();
  const { data = [], isLoading } = useNewsletters();
  const upsert = useUpsertNewsletter();
  const remove = useDeleteNewsletter();

  const [editing, setEditing] = useState<Draft | null>(null);

  const save = () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      notify.error("שגיאה", "כותרת חובה");
      return;
    }
    upsert.mutate(editing, { onSuccess: () => setEditing(null) });
  };

  const confirmDelete = (nl: Newsletter) => {
    remove.mutate(nl.id);
  };

  return (
    <View style={styles.wrap}>
      <Button
        title="ניוזלטר חדש"
        onPress={() => setEditing({ ...EMPTY })}
        icon={<Plus size={16} color="#fff" />}
        style={styles.addBtn}
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} />
      ) : data.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>אין ניוזלטרים</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.cardMain}>
                <View style={styles.cardHead}>
                  <Mail size={14} color={theme.textMuted} />
                  <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.main_title || item.title}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                  {item.newsletter_type || "general"}
                  {" · "}
                  {item.is_sent ? `נשלח (${item.sent_count ?? 0})` : "טיוטה"}
                  {item.is_published ? " · פורסם" : ""}
                  {item.show_telegram_button ? " · טלגרם" : ""}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => setEditing({ ...item, title: item.title })} hitSlop={8}>
                  <Pencil size={18} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
                  <Trash2 size={18} color="#e11d48" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "עריכת ניוזלטר" : "ניוזלטר חדש"}
        footer={
          <Button
            title={upsert.isPending ? "שומר..." : "שמירה"}
            onPress={save}
            disabled={upsert.isPending}
          />
        }
      >
        {editing ? (
          <View style={{ gap: 12 }}>
            <Field label="כותרת (פנימית, חובה)">
              <TextInput
                value={editing.title}
                onChangeText={(t) => setEditing({ ...editing, title: t })}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholderTextColor={theme.textMuted}
              />
            </Field>
            <Field label="כותרת ראשית">
              <TextInput
                value={editing.main_title ?? ""}
                onChangeText={(t) => setEditing({ ...editing, main_title: t })}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholderTextColor={theme.textMuted}
              />
            </Field>
            <Field label="סוג">
              <TextInput
                value={editing.newsletter_type ?? ""}
                onChangeText={(t) => setEditing({ ...editing, newsletter_type: t })}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="general"
                placeholderTextColor={theme.textMuted}
              />
            </Field>
            <Field label="תוכן">
              <TextInput
                value={editing.content ?? ""}
                onChangeText={(t) => setEditing({ ...editing, content: t })}
                multiline
                style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]}
                placeholderTextColor={theme.textMuted}
              />
            </Field>
            <Field label="HTML מותאם (גובר על התוכן)">
              <TextInput
                value={editing.custom_html ?? ""}
                onChangeText={(t) => setEditing({ ...editing, custom_html: t })}
                multiline
                style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]}
                placeholderTextColor={theme.textMuted}
              />
            </Field>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>כפתור טלגרם</Text>
              <Switch
                value={!!editing.show_telegram_button}
                onValueChange={(v) => setEditing({ ...editing, show_telegram_button: v })}
              />
            </View>
            <Text style={[styles.note, { color: theme.textMuted }]}>
              שליחה לא מתבצעת מכאן — הטיוטה נשמרת בלבד.
            </Text>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  addBtn: { marginBottom: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardMain: { flex: 1, alignItems: "flex-end" },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", fontFamily: fonts.display },
  cardMeta: { fontSize: 12, marginTop: 3, textAlign: "right" },
  cardActions: { flexDirection: "row", gap: 16, marginLeft: 12 },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: "right",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontWeight: "600" },
  fieldLabel: { fontSize: 12, fontWeight: "700", textAlign: "right" },
  note: { fontSize: 12, textAlign: "right", marginTop: 4 },
});
