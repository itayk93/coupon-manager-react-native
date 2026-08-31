import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail, Megaphone, CircleCheck, TriangleAlert } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notify } from "@/lib/notify";

/**
 * The page behind the unsubscribe link in every email.
 *
 * A preference centre rather than a single "you are unsubscribed" message: the
 * two kinds of mail are separated so stopping expiry reminders does not also
 * stop product news, and either can be switched back on from the same screen.
 *
 * The signed token in the link is the authentication — this screen is public
 * on purpose, because a recipient must be able to opt out from their inbox
 * without first remembering a password. Without a token it falls back to the
 * signed-in user's normal settings screen.
 */

type Scope = "expiry" | "marketing" | "all";

type State = {
  email: string;
  expiry_email: boolean;
  marketing_email: boolean;
};

export function UnsubscribeScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Scope | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        `manage-unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setState(data as State);
    } catch (err: any) {
      setError(err?.message || "הקישור אינו תקין או שפג תוקפו");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (scope: Scope, optedOut: boolean) => {
    if (!token) return;
    setSaving(scope);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-unsubscribe", {
        method: "POST",
        body: { token, scope, opted_out: optedOut },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setState(data as State);
      setSaved(true);
    } catch (err: any) {
      notify.error("העדכון נכשל", err?.message || "נסה שוב בעוד רגע");
    } finally {
      setSaving(null);
    }
  };

  // No token: nothing to authenticate with, so send the user to the screen
  // that already edits the same preferences behind a session.
  if (!token) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="ניהול התראות" />
        <View style={styles.centered}>
          <TriangleAlert size={40} color={theme.warning} />
          <Text style={[styles.title, { color: theme.text }]}>הקישור חסר פרטים</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            אפשר לנהל את כל ההתראות — מייל, Push והתראות בתוך האפליקציה — במסך ההגדרות.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() =>
              router.replace(session ? "/notification-settings" : "/(auth)/login")
            }
          >
            <Text style={styles.primaryBtnText}>
              {session ? "פתיחת הגדרות ההתראות" : "התחברות"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="ניהול התראות" />
        <View style={styles.centered}>
          <TriangleAlert size={40} color={theme.danger} />
          <Text style={[styles.title, { color: theme.text }]}>לא הצלחנו לפתוח את הקישור</Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.replace("/notification-settings")}
          >
            <Text style={styles.primaryBtnText}>ניהול ההתראות באפליקציה</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="ניהול התראות" />
        <MascotLoadingState title="טוען את הגדרות הדיוור" subtitle="בודקים את ההעדפות השמורות שלך" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="ניהול התראות" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: theme.textMuted }]}>
          ההעדפות של {state.email}. השינוי נשמר מיד, ואפשר להחזיר אותו בכל רגע.
        </Text>

        {saved ? (
          <View style={[styles.savedBanner, { backgroundColor: theme.successBg }]}>
            <CircleCheck size={18} color={theme.success} />
            <Text style={[styles.savedText, { color: theme.successText }]}>ההעדפות נשמרו</Text>
          </View>
        ) : null}

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <PreferenceRow
            icon={<Mail size={20} color={theme.textMuted} />}
            label="תזכורות תפוגת קופונים"
            hint="מייל לפני שקופון פוקע"
            value={state.expiry_email}
            busy={saving === "expiry"}
            onChange={(next) => apply("expiry", !next)}
            theme={theme}
          />
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          <PreferenceRow
            icon={<Megaphone size={20} color={theme.textMuted} />}
            label="ניוזלטר ודיוור שיווקי"
            hint="עדכוני מוצר ומבצעים"
            value={state.marketing_email}
            busy={saving === "marketing"}
            onChange={(next) => apply("marketing", !next)}
            theme={theme}
          />
        </View>

        <TouchableOpacity
          style={[styles.dangerBtn, { borderColor: theme.dangerBorder }]}
          disabled={saving !== null || (!state.expiry_email && !state.marketing_email)}
          onPress={() => apply("all", true)}
        >
          <Text style={[styles.dangerBtnText, { color: theme.dangerText }]}>
            הפסקת כל המיילים
          </Text>
        </TouchableOpacity>

        <Text style={[styles.footnote, { color: theme.textSubtle }]}>
          זה משפיע על מיילים בלבד. התראות Push והתראות בתוך האפליקציה נשלטות בנפרד
          במסך העדפות ההתראות.
        </Text>

        <TouchableOpacity
          style={[styles.linkBtn, { borderColor: theme.cardBorder }]}
          onPress={() => router.push("/notification-settings")}
        >
          <Text style={[styles.linkBtnText, { color: theme.primary }]}>
            {session ? "פתיחת העדפות ההתראות" : "התחברות לניהול כל ההתראות"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  icon,
  label,
  hint,
  value,
  busy,
  onChange,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View style={styles.row}>
      {busy ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.inputBorder, true: theme.primary }}
          thumbColor="#ffffff"
        />
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowHint, { color: theme.textSubtle }]}>{hint}</Text>
      </View>
      {icon}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { marginTop: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  content: { padding: 16, gap: 14 },
  intro: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: "right",
    lineHeight: 20,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 19,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  savedBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedText: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  group: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  rowHint: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginTop: 2,
  },
  separator: { height: 1 },
  primaryBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#ffffff", fontFamily: fonts.bodyBold, fontSize: 15 },
  dangerBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  linkBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  linkBtnText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    lineHeight: 19,
  },
});
