import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ExternalLink, Mail, Pencil, Plus, Trash2, Upload } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { Newsletter } from "@/integrations/supabase";
import { useNewsletters, useUpsertNewsletter, useDeleteNewsletter } from "@/hooks/useAdminManagement";
import { useNewsletterUpload } from "@/hooks/useNewsletterUpload";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Newsletter authoring for admins.
 *
 * The design is a file: an admin uploads a ZIP (Claude Design export) or a
 * single .html, which newsletter-upload hosts as a public page and mines for a
 * subject / hero image / preview paragraph. The email that goes out is a fixed
 * teaser template (see newsletterTeaserEmailHtml) that links to that page.
 *
 * Sending is deliberately NOT wired here. Bulk send is send-emails
 * (mode: "newsletter"); a review send is newsletter-preview. This screen only
 * authors.
 */

type Draft = Partial<Newsletter> & { id?: number; title: string };

export function NewslettersTab() {
  const { theme } = useAppTheme();
  const { data = [], isLoading } = useNewsletters();
  const upsert = useUpsertNewsletter();
  const remove = useDeleteNewsletter();
  const upload = useNewsletterUpload();

  const [editing, setEditing] = useState<Draft | null>(null);

  const save = (next?: Draft) => {
    const draft = next ?? editing;
    if (!draft) return;
    if (!draft.title.trim()) {
      notify.error("שגיאה", "כותרת פנימית חובה");
      return;
    }
    upsert.mutate(draft, { onSuccess: () => setEditing(null) });
  };

  const pickFile = async () => {
    if (!editing?.id) {
      notify.error("שמור קודם", "צור את הניוזלטר לפני העלאת קובץ");
      return;
    }
    const result = await upload.mutateAsync(editing.id);
    if (result) {
      setEditing({
        ...editing,
        bundle_path: result.bundle_path,
        web_url: result.web_url,
        email_subject: result.email_subject,
        hero_image_url: result.hero_image_url,
        preview_text: result.preview_text,
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <Button
        title="ניוזלטר חדש"
        onPress={() => setEditing({ title: "" })}
        icon={<Plus size={16} color="#fff" />}
        style={styles.addBtn}
      />

      {isLoading ? (
        <MascotLoadingState compact title="טוען ניוזלטרים" />
      ) : data.length === 0 ? (
        <EmptyState title="עוד אין ניוזלטרים" subtitle="יוצרים את הניוזלטר הראשון ומתחילים לשלוח עדכונים." actionTitle="ניוזלטר חדש" onAction={() => setEditing({ title: "" })} />
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
                    {item.email_subject || item.title}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, { color: item.web_url ? theme.textMuted : "#e11d48" }]}>
                  {item.web_url
                    ? item.is_sent
                      ? `נשלח (${item.sent_count ?? 0})`
                      : "מוכן לשליחה"
                    : "חסר קובץ עיצוב"}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => setEditing({ ...item, title: item.title })} hitSlop={8}>
                  <Pencil size={18} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove.mutate(item.id)} hitSlop={8}>
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
            onPress={() => save()}
            disabled={upsert.isPending}
          />
        }
      >
        {editing ? (
          <View style={{ gap: 14 }}>
            <Field label="כותרת פנימית (לרשימה, חובה)">
              <TextInput
                value={editing.title}
                onChangeText={(t) => setEditing({ ...editing, title: t })}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholderTextColor={theme.textMuted}
              />
            </Field>

            {!editing.id ? (
              <Text style={[styles.note, { color: theme.textMuted }]}>
                שמור את הניוזלטר, ואז אפשר יהיה להעלות קובץ עיצוב.
              </Text>
            ) : (
              <>
                <Button
                  title={upload.isPending ? "מעלה..." : editing.web_url ? "החלף קובץ עיצוב" : "העלה קובץ עיצוב (ZIP או HTML)"}
                  onPress={pickFile}
                  disabled={upload.isPending}
                  variant="outline"
                  icon={<Upload size={16} color={theme.primary} />}
                />

                {editing.web_url ? (
                  <>
                    <TouchableOpacity
                      style={styles.linkRow}
                      onPress={() => editing.web_url && Linking.openURL(editing.web_url)}
                    >
                      <ExternalLink size={14} color={theme.primary} />
                      <Text style={[styles.linkText, { color: theme.primary }]}>צפייה בדף המלא</Text>
                    </TouchableOpacity>

                    {editing.hero_image_url ? (
                      <Image
                        source={{ uri: editing.hero_image_url }}
                        style={styles.hero}
                        resizeMode="cover"
                      />
                    ) : null}

                    <Field label="נושא המייל">
                      <TextInput
                        value={editing.email_subject ?? ""}
                        onChangeText={(t) => setEditing({ ...editing, email_subject: t })}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                        placeholderTextColor={theme.textMuted}
                      />
                    </Field>
                    <Field label="טקסט פתיחה (טיזר)">
                      <TextInput
                        value={editing.preview_text ?? ""}
                        onChangeText={(t) => setEditing({ ...editing, preview_text: t })}
                        multiline
                        style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]}
                        placeholderTextColor={theme.textMuted}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            )}

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
  multiline: { minHeight: 80, textAlignVertical: "top" },
  hero: { width: "100%", height: 130, borderRadius: radii.sm },
  linkRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 2 },
  linkText: { fontSize: 13, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "700", textAlign: "right" },
  note: { fontSize: 12, textAlign: "right", lineHeight: 18 },
});
