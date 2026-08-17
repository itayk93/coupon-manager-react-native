import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  FileText,
  AlertCircle,
  LogOut,
  ChevronLeft,
  Settings as SettingsIcon,
  Lock,
  Share2,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

export function SettingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { user, isAdmin, signOut } = useAuth();
  const biometric = useBiometricAuth();

  const handleToggleBiometric = async (next: boolean) => {
    if (!next) {
      await biometric.disable();
      notify.success("נעילה ביומטרית בוטלה");
      return;
    }
    // Prove the device can actually authenticate before turning the lock on,
    // otherwise the user could lock themselves out of their own wallet.
    const ok = await biometric.authenticate("הפעלת נעילה ביומטרית");
    if (!ok) return;
    await biometric.enable(user?.email || "");
    notify.success(`${biometric.label} הופעל`);
  };

  const handleSignOut = () => {
    notify.confirm(
      "התנתקות מהחשבון",
      "האם אתה בטוח שברצונך להתנתק מהאפליקציה?",
      async () => {
        await signOut();
      },
      "התנתק"
    );
  };

  const displayName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.email ||
    "משתמש";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Text style={[styles.pageTitle, { color: theme.text }]}>חשבון</Text>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/profile")}
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <ChevronLeft size={20} color={theme.textMuted} />

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textMuted }]}>
              {user?.email}
            </Text>
            {isAdmin ? (
              <View style={[styles.adminTag, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                <Text style={[styles.adminTagText, { color: theme.primary }]}>
                  מנהל מערכת (Admin)
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: theme.primary },
            ]}
          >
            <Text style={[styles.avatarLetter, styles.avatarLetterOnBrand]}>
              {(user?.first_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Admin Dashboard Entry (if Admin) */}
        {isAdmin ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              ניהול מערכת
            </Text>
            <View
              style={[
                styles.menuGroup,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.push("/admin")}
                style={styles.menuItem}
              >
                <ChevronLeft size={18} color={theme.textMuted} />
                <View style={styles.menuItemLabelGroup}>
                  <Text style={[styles.menuItemText, { color: theme.text }]}>
                    פאנל ניהול (Admin Dashboard)
                  </Text>
                  <Shield size={20} color={theme.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* General Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            העדפות תצוגה
          </Text>
          <View
            style={[
              styles.menuGroup,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >

            {biometric.isAvailable ? (
              <View style={styles.menuItem}>
                <Switch
                  value={biometric.isEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                  thumbColor="#ffffff"
                />
                <View style={styles.menuItemLabelGroup}>
                  <Text style={[styles.menuItemText, { color: theme.text }]}>
                    נעילה עם {biometric.label}
                  </Text>
                  <ShieldCheck size={20} color={theme.textMuted} />
                </View>
              </View>
            ) : null}

            {/* Sharing Entry */}
            <TouchableOpacity
              onPress={() => router.push("/sharing")}
              style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  קופונים משותפים
                </Text>
                <Share2 size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Home-screen widget */}
            <TouchableOpacity
              onPress={() => router.push("/widget-settings")}
              style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  ווידג'ט מסך הבית
                </Text>
                <LayoutGrid size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help & Content */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            מידע ותמיכה
          </Text>
          <View
            style={[
              styles.menuGroup,
              {
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.push("/about")}
              style={styles.menuItem}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  אודות Coupon Master
                </Text>
                <HelpCircle size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/faq")}
              style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  שאלות נפוצות (FAQ)
                </Text>
                <FileText size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/privacy")}
              style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  מדיניות פרטיות ותנאים
                </Text>
                <Lock size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/issues")}
              style={[styles.menuItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <ChevronLeft size={18} color={theme.textMuted} />
              <View style={styles.menuItemLabelGroup}>
                <Text style={[styles.menuItemText, { color: theme.text }]}>
                  דיווח על תקלה / פנייה
                </Text>
                <AlertCircle size={20} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSignOut}
          style={[styles.signOutBtn, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}
        >
          <LogOut size={18} color={theme.danger} />
          <Text style={[styles.signOutText, { color: theme.danger }]}>
            התנתק מהחשבון
          </Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: theme.textMuted }]}>
          גרסה 1.0.0 (Native Mobile)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 4,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
    alignItems: "flex-end",
    marginRight: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "800",
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  adminTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  adminTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "800",
  },
  avatarLetterOnBrand: {
    color: "#ffffff",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemLabelGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  signOutBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "800",
  },
  versionText: {
    fontSize: 12,
    textAlign: "center",
  },
});
