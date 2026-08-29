import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera, Check, User, Lock, Mail, Shield } from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";
import { linkSocialProvider, SocialProvider } from "@/lib/socialAuth";
import { Modal } from "@/components/ui/Modal";
import { PROFILE_AVATARS, ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { uploadProfileImage } from "@/lib/profileImage";

export function ProfileScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { user, isAdmin } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState(
    profile?.first_name || user?.first_name || ""
  );
  const [lastName, setLastName] = useState(
    profile?.last_name || user?.last_name || ""
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<SocialProvider[]>([]);
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const saveAvatar = async (profileImage: string) => {
    try {
      await updateProfile.mutateAsync({ profile_image: profileImage });
      setAvatarPickerOpen(false);
      notify.success("תמונת הפרופיל עודכנה");
    } catch {
      // useUpdateProfile presents the database error to the user.
    }
  };

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify.warning("נדרשת הרשאה לגלריה", "אפשרו גישה לתמונות כדי להעלות תמונת פרופיל.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setAvatarLoading(true);
    try {
      const publicUrl = await uploadProfileImage(result.assets[0]);
      await saveAvatar(publicUrl);
    } catch (error: any) {
      notify.error("העלאת התמונה נכשלה", error.message || "נסו שוב.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const loadLinkedProviders = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const providers = data.identities
      .map((identity) => identity.provider)
      .filter((provider): provider is SocialProvider =>
        provider === "google" || provider === "apple"
      );
    setLinkedProviders(providers);
  }, []);

  useEffect(() => {
    loadLinkedProviders().catch((error) => {
      console.error("Failed to load linked identities:", error);
    });
  }, [loadLinkedProviders]);

  const handleLinkProvider = async (provider: SocialProvider) => {
    if (linkedProviders.includes(provider)) return;
    setLinkingProvider(provider);
    try {
      await linkSocialProvider(provider);
      await loadLinkedProviders();
      notify.success("החיבור נוסף לחשבון הקיים");
    } catch (err: any) {
      notify.error("שגיאה בחיבור החשבון", err.message || "החיבור נכשל. נסו שוב.");
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleUpdateDetails = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      notify.error("יש להזין שם פרטי ושם משפחה");
      return;
    }

    await updateProfile.mutateAsync({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      notify.error("סיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("אימות הסיסמה אינו תואם");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      notify.error("שגיאה בעדכון סיסמה", err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="פרופיל אישי" showBack onBack={() => router.back()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setAvatarPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="החלפת תמונת פרופיל"
          style={styles.avatarSection}
        >
          <View style={[styles.editAvatarBadge, { backgroundColor: theme.primary }]}>
            <Camera size={16} color="#FFFFFF" />
          </View>
          <ProfileAvatar value={profile?.profile_image} size={96} />
          <Text style={[styles.avatarTitle, { color: theme.text }]}>תמונת פרופיל</Text>
          <Text style={[styles.avatarHint, { color: theme.textMuted }]}>לחצו כדי לבחור דמות או להעלות תמונה</Text>
        </TouchableOpacity>

        {/* Personal Details Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              פרטים אישיים
            </Text>
            <User size={18} color={theme.primary} />
          </View>

          <Input
            label="כתובת אימייל"
            value={user?.email}
            editable={false}
            icon={<Mail size={16} color={theme.textMuted} />}
          />

          {/* row-reverse puts the first child on the right, where Hebrew starts. */}
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="שם פרטי"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.halfCol}>
              <Input
                label="שם משפחה"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Button
            title="עדכן פרטים"
            onPress={handleUpdateDetails}
            loading={updateProfile.isPending}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Change Password Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              שינוי סיסמה
            </Text>
            <Lock size={18} color={theme.primary} />
          </View>

          <Input
            label="סיסמה חדשה"
            placeholder="••••••••"
            isPassword
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Input
            label="אימות סיסמה חדשה"
            placeholder="••••••••"
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            title="עדכן סיסמה"
            onPress={handleChangePassword}
            loading={passwordLoading}
            variant="secondary"
            style={{ marginTop: 8 }}
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>חיבורים לחשבון</Text>
            <Shield size={18} color={theme.primary} />
          </View>
          <Text style={[styles.connectionsHint, { color: theme.textMuted }]}>חיבור מתוך המסך הזה משייך את Google או Apple לאותו משתמש ולכל הקופונים הקיימים.
          </Text>
          {(["google", "apple"] as const).map((provider) => {
            const linked = linkedProviders.includes(provider);
            const label = provider === "google" ? "Google" : "Apple";
            return (
              <TouchableOpacity
                key={provider}
                activeOpacity={0.8}
                disabled={linked || linkingProvider !== null}
                onPress={() => handleLinkProvider(provider)}
                style={[
                  styles.connectionButton,
                  { borderColor: theme.inputBorder },
                  linked && styles.connectionButtonLinked,
                ]}
              >
                <Text
                  style={[
                    styles.connectionStatus,
                    { color: linked ? "#047857" : theme.primary },
                  ]}
                >
                  {linked ? "מחובר" : linkingProvider === provider ? "מתחבר..." : "חיבור"}
                </Text>
                <Text style={[styles.connectionLabel, { color: theme.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Role & Verification Badge */}
        {isAdmin ? (
          <View
            style={[
              styles.adminBox,
              {
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                borderColor: "rgba(16, 185, 129, 0.3)",
              },
            ]}
          >
            <Shield size={20} color={theme.primary} />
            <Text style={[styles.adminBoxText, { color: theme.primary }]}>
              לחשבון זה יש הרשאות מנהל מערכת (Admin)
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        title="בחירת תמונת פרופיל"
        subtitle="20 דמויות של קופון מאסטר או תמונה מהגלריה"
      >
        <TouchableOpacity
          onPress={pickProfileImage}
          disabled={avatarLoading}
          style={[styles.uploadButton, { borderColor: theme.primary, backgroundColor: theme.primaryTint }]}
        >
          <Text style={[styles.uploadButtonText, { color: theme.primary }]}>
            {avatarLoading ? "מעלה תמונה..." : "העלאה מהגלריה"}
          </Text>
          <Camera size={20} color={theme.primary} />
        </TouchableOpacity>
        <View style={styles.avatarGrid}>
          {PROFILE_AVATARS.map((avatar) => {
            const selected = profile?.profile_image === avatar;
            return (
              <TouchableOpacity
                key={avatar}
                onPress={() => saveAvatar(avatar)}
                disabled={updateProfile.isPending || avatarLoading}
                accessibilityRole="button"
                accessibilityLabel={`בחירת דמות ${avatar.split(":")[1]}`}
                style={[
                  styles.avatarOption,
                  { borderColor: selected ? theme.primary : "transparent" },
                ]}
              >
                <ProfileAvatar value={avatar} size={64} />
                {selected ? (
                  <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  avatarSection: { alignItems: "center", marginBottom: 18, position: "relative" },
  editAvatarBadge: { position: "absolute", zIndex: 2, top: 66, marginLeft: 68, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" },
  avatarTitle: { fontFamily: fonts.display, fontSize: 17, fontWeight: "800", marginTop: 10 },
  avatarHint: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  uploadButton: { minHeight: 52, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 18 },
  uploadButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: "700" },
  avatarGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  avatarOption: { width: "21%", alignItems: "center", padding: 4, borderRadius: 40, borderWidth: 3, position: "relative" },
  selectedBadge: { position: "absolute", left: 0, bottom: 2, width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  halfCol: {
    flex: 1,
    // Without this a long value escapes the flex child instead of being clipped.
    minWidth: 0,
  },
  adminBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  adminBoxText: {
    fontSize: 13,
    fontWeight: "700",
  },
  connectionsHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginBottom: 12,
  },
  connectionButton: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectionButtonLinked: {
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  connectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "700",
  },
  connectionStatus: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: "700",
  },
});
