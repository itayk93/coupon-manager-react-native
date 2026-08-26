import React, { useState } from "react";
import {
  Linking,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Bell, Mail, MessageSquare, Smartphone, Clock, CalendarClock } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import { usePwaNotifications } from "@/hooks/usePwaNotifications";
import { useNativeNotifications } from "@/hooks/useNativeNotifications";
import {
  NOTIFICATION_WINDOWS as WINDOW_OPTIONS,
  DAILY_REMINDER_DAYS,
} from "@/lib/notificationWindows";

function ToggleRow({
  label,
  icon,
  value,
  onValueChange,
  theme,
}: {
  label: string;
  icon: React.ReactNode;
  value: boolean;
  onValueChange: (next: boolean) => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View style={styles.row}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.inputBorder, true: theme.primary }}
        thumbColor="#ffffff"
      />
      <View style={styles.rowLabel}>
        {icon}
        <Text style={[styles.rowText, { color: theme.text }]}>{label}</Text>
      </View>
    </View>
  );
}

export function NotificationSettingsScreen() {
  const { theme } = useAppTheme();
  const { data: prefs, isLoading: prefsLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const pwa = usePwaNotifications();
  const native = useNativeNotifications();

  const [windowError, setWindowError] = useState<string | null>(null);

  if (prefsLoading || !prefs) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="העדפות התראות" />
        <ActivityIndicator style={styles.loader} size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const toggleWindow = (days: number) => {
    const current = prefs.windows || [];
    const next = current.includes(days)
      ? current.filter((w) => w !== days)
      : [...current, days];

    if (next.length === 0) {
      setWindowError("חובה לבחור לפחות חלון תזכורת אחד");
      return;
    }

    setWindowError(null);
    updatePrefs.mutate({ windows: next.sort((a, b) => b - a) });
  };

  /**
   * Whether push can actually reach this device — not merely whether the
   * account would like it to.
   *
   * The switch used to read `prefs.push`, which defaults to true for every new
   * account. It therefore showed "on" from the very first launch, so nobody
   * ever flipped it on, so the code that asks the OS for permission and
   * registers the device never ran. The result was 132 accounts, zero
   * registered devices, and a switch that promised notifications nothing was
   * able to deliver.
   */
  const deviceReady = native.isSupported
    ? native.notificationsEnabled
    : pwa.isSupported
      ? pwa.notificationsEnabled
      : false;
  const pushOn = prefs.push && deviceReady;
  const blockedBySystem = native.isSupported && native.permission === "denied";

  const handlePushToggle = async (next: boolean) => {
    try {
      if (next) {
        // iOS only ever shows the permission dialog once. After a refusal the
        // request resolves as denied without any prompt, so send the user to
        // the place where it can actually be changed.
        if (blockedBySystem) {
          notify.error(
            "ההתראות חסומות בהגדרות המכשיר",
            "צריך להפעיל אותן באפליקציית ההגדרות כדי לקבל תזכורות.",
          );
          void Linking.openSettings();
          return;
        }
        // Prefer the native channel on iOS/Android, web push on web.
        if (native.isSupported) await native.enable();
        else if (pwa.isSupported) await pwa.enable();
        else throw new Error("Push לא נתמך במכשיר הזה.");
      } else {
        if (native.isSupported) await native.disable();
        if (pwa.isSupported) await pwa.disable();
      }
      await updatePrefs.mutateAsync({ push: next });
    } catch (error: any) {
      notify.error("שגיאה בהפעלת Push", error.message);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="העדפות התראות" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.groupTitle, { color: theme.textMuted }]}>ערוצי התראות</Text>

          <ToggleRow
            label="התראות מייל"
            icon={<Mail size={20} color={theme.textMuted} />}
            value={prefs.email}
            onValueChange={(next) => updatePrefs.mutate({ email: next })}
            theme={theme}
          />
          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <ToggleRow
            label="התראות Push"
            icon={<Smartphone size={20} color={theme.textMuted} />}
            value={pushOn}
            onValueChange={handlePushToggle}
            theme={theme}
          />
          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <ToggleRow
            label="התראות בתוך האפליקציה"
            icon={<MessageSquare size={20} color={theme.textMuted} />}
            value={prefs.in_app}
            onValueChange={(next) => updatePrefs.mutate({ in_app: next })}
            theme={theme}
          />
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, { color: theme.textMuted }]}>חלונות תזכורת</Text>
            <Clock size={18} color={theme.textMuted} />
          </View>
          <Text style={[styles.hint, { color: theme.textSubtle }]}>
            בחר מתי לקבל התראה לפני שהקופון פוקע
          </Text>
          {WINDOW_OPTIONS.map((option) => {
            const selected = (prefs.windows || []).includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => toggleWindow(option.value)}
                style={[styles.windowRow, { borderBottomColor: theme.border }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: selected ? theme.primary : theme.inputBorder },
                    selected && { backgroundColor: theme.primary },
                  ]}
                >
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text style={[styles.windowText, { color: theme.text }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
          {windowError ? <Text style={[styles.error, { color: theme.danger }]}>{windowError}</Text> : null}

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <ToggleRow
            label={`תזכורת יומית ב-${DAILY_REMINDER_DAYS} הימים האחרונים`}
            icon={<CalendarClock size={20} color={theme.textMuted} />}
            value={prefs.daily_within !== null}
            onValueChange={(next) =>
              updatePrefs.mutate({ daily_within: next ? DAILY_REMINDER_DAYS : null })
            }
            theme={theme}
          />
          <Text style={[styles.hint, { color: theme.textSubtle }]}>
            כשמופעל, קופון שקרוב לפוג יזכיר לעצמו כל יום בערוצים שבחרת למעלה,
            ולא רק בחלונות הקבועים
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.groupTitle, { color: theme.textMuted }]}>סטטוס Push</Text>
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            {!native.isSupported && !pwa.isSupported
              ? "Push לא נתמך במכשיר הזה"
              : deviceReady
                ? "המכשיר הזה רשום לקבלת התראות"
                : blockedBySystem
                  ? "ההתראות חסומות בהגדרות המכשיר"
                  : "המכשיר הזה לא רשום — הפעל את המתג למעלה"}
          </Text>
          {(native.isSupported || pwa.isSupported) && deviceReady && (
            <TouchableOpacity
              onPress={() => {
                if (native.isSupported) native.sendTest().catch((e) => notify.error("שגיאה", e.message));
                else pwa.sendTest().catch((e) => notify.error("שגיאה", e.message));
              }}
              style={[styles.testButton, { backgroundColor: theme.primaryTint }]}
            >
              <Bell size={16} color={theme.primary} />
              <Text style={[styles.testButtonText, { color: theme.primary }]}>שלח התראת בדיקה</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { marginTop: 40 },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  group: {
    borderRadius: radii.cardLg,
    borderWidth: 1,
    padding: 16,
  },
  groupHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  groupTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 6,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  rowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  windowRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  windowText: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: "right",
    marginTop: 6,
  },
  statusText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "right",
    marginBottom: 10,
  },
  testButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  testButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
  },
});
