import React, { useState } from "react";
import {
  Linking,
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Bell, HelpCircle, Mail, Megaphone, MessageSquare, Smartphone, Clock, CalendarClock } from "lucide-react-native";
import {
  NOTIFICATION_TYPES,
  isTypeChannelOn,
  withTypeChannel,
  type NotificationChannel,
  type NotificationTypeId,
} from "@/lib/notificationTypes";
import { Header } from "@/components/ui/Header";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import { usePwaNotifications } from "@/hooks/usePwaNotifications";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";
import { useNativeNotifications } from "@/hooks/useNativeNotifications";
import {
  NOTIFICATION_WINDOWS as WINDOW_OPTIONS,
  DAILY_REMINDER_DAYS,
} from "@/lib/notificationWindows";
import { logActivity } from "@/lib/activityLog";
import { useOptOut, useSetOptOut } from "@/hooks/useConsent";

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

/**
 * One kind of message, with the two channels it can arrive on.
 *
 * "In the app" is not offered per kind: the feed is where everything lands and
 * a kind missing from it would be a message the user can never go back and
 * read. The master switch above still turns the whole feed off.
 *
 * The sample line is deliberately a real message rather than a description.
 * "סיכום חודשי" is a category; "באוגוסט חסכת 869.80 ₪" is the thing you are
 * agreeing to receive.
 */
function TypeCard({
  meta, typeChannels, onChange, pushAvailable, emailAvailable, theme,
}: {
  meta: typeof NOTIFICATION_TYPES[number];
  typeChannels: any;
  onChange: (type: NotificationTypeId, channel: NotificationChannel, value: boolean) => void;
  pushAvailable: boolean;
  emailAvailable: boolean;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.typeCard, { borderBottomColor: theme.border }]}>
      <View style={styles.typeLabelRow}>
        <Text style={[styles.typeLabel, { color: theme.text }]}>{meta.label}</Text>
        <TouchableOpacity
          onPress={() => setOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.helpButton, { backgroundColor: theme.surfaceAlt }]}
        >
          <HelpCircle size={17} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.typeDescription, { color: theme.textMuted }]}>{meta.description}</Text>
      <View style={[styles.sampleBubble, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.sampleText, { color: theme.textSecondary }]}>{meta.sample}</Text>
      </View>
      <View style={styles.channelRow}>
        <View style={styles.channelToggle}>
          <Switch
            value={pushAvailable && isTypeChannelOn(typeChannels, meta.id, "push")}
            disabled={!pushAvailable}
            onValueChange={(next) => onChange(meta.id, "push", next)}
            trackColor={{ false: theme.inputBorder, true: theme.primary }}
            thumbColor="#ffffff"
          />
          <Text style={[styles.channelLabel, { color: theme.textMuted }]}>פוש</Text>
        </View>
        <View style={styles.channelToggle}>
          <Switch
            value={emailAvailable && isTypeChannelOn(typeChannels, meta.id, "email")}
            disabled={!emailAvailable}
            onValueChange={(next) => onChange(meta.id, "email", next)}
            trackColor={{ false: theme.inputBorder, true: theme.primary }}
            thumbColor="#ffffff"
          />
          <Text style={[styles.channelLabel, { color: theme.textMuted }]}>מייל</Text>
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.helpScrim}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[styles.helpCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <View style={styles.helpHeader}>
              <Text style={[styles.helpTitle, { color: theme.text }]}>{meta.label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={[styles.helpClose, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.helpSample, { color: theme.textSecondary }]}>{meta.sample}</Text>

            <View style={styles.helpRow}>
              <Text style={[styles.helpRowLabel, { color: theme.textMuted }]}>מה כתוב</Text>
              <Text style={[styles.helpRowText, { color: theme.text }]}>{meta.explanation.what}</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpRowLabel, { color: theme.textMuted }]}>מתי נשלח</Text>
              <Text style={[styles.helpRowText, { color: theme.text }]}>{meta.explanation.when}</Text>
            </View>
            <View style={styles.helpRow}>
              <Text style={[styles.helpRowLabel, { color: theme.textMuted }]}>לאן עובר</Text>
              <Text style={[styles.helpRowText, { color: theme.text }]}>{meta.explanation.where}</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export function NotificationSettingsScreen() {
  const { theme } = useAppTheme();
  const { data: prefs, isLoading: prefsLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const pwa = usePwaNotifications();
  const native = useNativeNotifications();
  // Above the loading return, with the others. Called after it, this ran on
  // the render that had preferences and not on the render that did not, so
  // React saw the hook count grow the moment the query resolved and threw
  // instead of drawing the screen — a spinner that never became anything.
  const marketing = useOptOut();
  const setMarketingOptOut = useSetOptOut();

  const [windowError, setWindowError] = useState<string | null>(null);

  if (prefsLoading || !prefs || marketing.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <Header title="ההתראות שלי" />
        <MascotLoadingState title="טוען את ההתראות שלך" subtitle="מתאימים את ההעדפות לחשבון" />
      </SafeAreaView>
    );
  }

  const toggleWindow = (days: number) => {
    const current = prefs.windows || [];
    const next = current.includes(days)
      ? current.filter((w) => w !== days)
      : [...current, days];

    if (next.length === 0) {
      setWindowError("צריך להשאיר לפחות תזכורת אחת");
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


  const handleTypeChannel = (
    type: NotificationTypeId,
    channel: NotificationChannel,
    value: boolean,
  ) => {
    updatePrefs.mutate({
      type_channels: withTypeChannel(prefs.type_channels, type, channel, value),
    });
  };

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
      logActivity(next ? "enable_push" : "disable_push");
    } catch (error: any) {
      notify.error("שגיאה בהפעלת Push", error.message);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Header title="ההתראות שלי" />

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
          <Text style={[styles.groupTitle, { color: theme.textMuted }]}>דיוור שיווקי</Text>
          <ToggleRow
            label="ניוזלטר, עדכוני מוצר והטבות"
            icon={<Megaphone size={20} color={theme.textMuted} />}
            value={Boolean(marketing.data?.marketing_enabled)}
            onValueChange={(next) => setMarketingOptOut.mutate(!next)}
            theme={theme}
          />
          <Text style={[styles.hint, { color: theme.textSubtle }]}>
            לא חובה. אפשר להצטרף או לבטל בכל רגע.
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.groupTitle, { color: theme.textMuted }]}>על מה לעדכן</Text>
          <Text style={[styles.hint, { color: theme.textSubtle }]}>
            בוחרים מה מגיע בפוש או במייל. הכול עדיין נשמר כאן באפליקציה.
          </Text>
          {NOTIFICATION_TYPES.map((meta) => (
            <TypeCard
              key={meta.id}
              meta={meta}
              typeChannels={prefs.type_channels}
              pushAvailable={pushOn}
              emailAvailable={prefs.email}
              onChange={handleTypeChannel}
              theme={theme}
            />
          ))}
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, { color: theme.textMuted }]}>מתי להזכיר</Text>
            <Clock size={18} color={theme.textMuted} />
          </View>
          <Text style={[styles.hint, { color: theme.textSubtle }]}>
            כמה זמן לפני שקופון פג לשלוח תזכורת?
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
            כשקופון ממש קרוב לפוג, נשלח תזכורת בכל יום בערוצים שנבחרו.
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.groupTitle, { color: theme.textMuted }]}>פוש במכשיר הזה</Text>
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            {!native.isSupported && !pwa.isSupported
              ? "Push לא נתמך במכשיר הזה"
              : deviceReady
                ? "הפוש פעיל ומוכן"
                : blockedBySystem
                  ? "ההתראות חסומות בהגדרות המכשיר"
                  : "הפוש עדיין כבוי — אפשר להפעיל למעלה"}
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
  typeCard: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  typeLabelRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  helpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  typeDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sampleBubble: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginTop: 2,
  },
  sampleText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  channelRow: {
    flexDirection: "row-reverse",
    gap: 20,
    marginTop: 4,
  },
  channelToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  channelLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
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
  helpScrim: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  helpCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radii.sheet,
    borderWidth: 1,
    padding: 22,
  },
  helpHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  helpTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  helpClose: {
    fontSize: 18,
    fontWeight: "700",
  },
  helpSample: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 14,
  },
  helpRow: {
    marginTop: 12,
  },
  helpRowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 2,
  },
  helpRowText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
