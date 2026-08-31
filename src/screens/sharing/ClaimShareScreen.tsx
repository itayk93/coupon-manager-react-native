import React, { useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Gift, TriangleAlert } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii } from "@/lib/theme";
import { formatIls } from "@/lib/formatIls";
import { formatDateHebrew } from "@/lib/formatDate";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { shareTokenFromPath } from "@/lib/shareLinks";
import {
  shareLinkErrorMessage,
  useClaimShareLink,
  useShareLinkPreview,
} from "@/hooks/useShareLink";
import { MascotLoadingState } from "@/components/ui/MascotLoadingState";

/**
 * Where a share link lands.
 *
 * The link arrives from outside the app — AirDrop, a message, a scanned QR
 * code — so the person opening it may be signed in as the sender, or may be
 * holding a link somebody else already claimed. Both end here, and the
 * screen's job is to say which one happened in a sentence. Someone signed out
 * never reaches it: the root auth guard remembers the route, sends them to
 * sign in, and drops them back here afterwards.
 *
 * Nothing is claimed on arrival. Accepting a `transfer` moves a coupon out of
 * someone's wallet permanently, so it takes a deliberate tap, and the preview
 * shows what is on offer without the code that makes it worth anything.
 */
export function ClaimShareScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { session, isLoading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = shareTokenFromPath(raw);

  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const preview = useShareLinkPreview(session ? token : null);
  const claim = useClaimShareLink();

  const handleRespond = async (accept: boolean) => {
    if (!token) return;
    const result = await claim.mutateAsync({ token, accept });
    setDone(result.status === "declined" ? "declined" : "accepted");
  };

  const body = (() => {
    if (!token) {
      return <Message theme={theme} text="הקישור אינו תקין" />;
    }
    if (authLoading || !session) {
      return <Loading />;
    }
    if (done) {
      return (
        <Message
          theme={theme}
          text={done === "accepted" ? "הקופון בארנק שלך" : "ההצעה נדחתה"}
          action={
            <Button title="למסך הראשי" onPress={() => router.replace("/(tabs)")} />
          }
        />
      );
    }
    if (preview.isLoading) {
      return <Loading />;
    }
    if (preview.isError || !preview.data) {
      return (
        <Message
          theme={theme}
          text={shareLinkErrorMessage(preview.error)}
          action={
            <Button title="למסך הראשי" onPress={() => router.replace("/(tabs)")} />
          }
        />
      );
    }

    const data = preview.data;
    if (data.isOwnLink) {
      return (
        <Message
          theme={theme}
          text="זה הקישור שיצרת. שלח אותו למי שאתה רוצה לשתף איתו."
          action={
            <Button title="למסך הראשי" onPress={() => router.replace("/(tabs)")} />
          }
        />
      );
    }

    const remaining = Math.max(0, (data.value || 0) - (data.usedValue || 0));
    const logo = getCompanyLogoSource(data.company);
    const isTransfer = data.shareType === "transfer";

    return (
      <View style={styles.card}>
        <View style={[styles.logoWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          {logo ? (
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          ) : (
            <Gift size={34} color={theme.primary} />
          )}
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{data.company}</Text>
        <Text style={[styles.amount, { color: theme.primary }]}>{formatIls(remaining)}</Text>

        {data.description ? (
          <Text style={[styles.desc, { color: theme.textMuted }]}>{data.description}</Text>
        ) : null}
        {data.expiration ? (
          <Text style={[styles.desc, { color: theme.textMuted }]}>
            {`בתוקף עד ${formatDateHebrew(data.expiration)}`}
          </Text>
        ) : null}

        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          {data.senderFirstName
            ? isTransfer
              ? `${data.senderFirstName} מעביר לך את הקופון הזה`
              : `${data.senderFirstName} משתף איתך את הקופון הזה`
            : isTransfer
              ? "מישהו מעביר לך את הקופון הזה"
              : "מישהו משתף איתך את הקופון הזה"}
        </Text>

        <View style={[styles.note, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <TriangleAlert size={16} color={theme.textMuted} />
          <Text style={[styles.noteText, { color: theme.textMuted }]}>
            {isTransfer
              ? "אחרי האישור הקופון יהיה שלך בלבד, והוא ייצא מהארנק של מי ששלח."
              : "אחרי האישור שניכם תשתמשו מאותה יתרה, וכל שימוש יעודכן לשניכם."}
          </Text>
        </View>

        <Button
          title={isTransfer ? "קבל את הקופון" : "אשר שיתוף"}
          onPress={() => handleRespond(true)}
          disabled={claim.isPending}
          loading={claim.isPending}
          style={styles.cta}
        />

        <TouchableOpacity
          onPress={() => handleRespond(false)}
          disabled={claim.isPending}
          style={styles.decline}
        >
          <Text style={[styles.declineText, { color: theme.textMuted }]}>לא, תודה</Text>
        </TouchableOpacity>
      </View>
    );
  })();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="קופון בשבילך" showBack />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </SafeAreaView>
  );
}

function Loading() {
  return <MascotLoadingState title="מכינים את הקופון" subtitle="בודקים את הקישור ואת פרטי ההעברה" />;
}

function Message({
  theme,
  text,
  action,
}: {
  theme: { text: string };
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text style={[styles.message, { color: theme.text }]}>{text}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 60 },
  message: { fontFamily: fonts.bodyMedium, fontSize: 16, textAlign: "center", lineHeight: 24 },
  card: { alignItems: "center", gap: 10 },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 60, height: 60 },
  title: { fontFamily: fonts.bodyBold, fontSize: 22, textAlign: "center" },
  amount: { fontFamily: fonts.bodyBold, fontSize: 30, textAlign: "center" },
  desc: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
  lead: { fontFamily: fonts.bodyMedium, fontSize: 15, textAlign: "center", marginTop: 6 },
  note: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    marginTop: 6,
    alignSelf: "stretch",
  },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 13, textAlign: "right", lineHeight: 19 },
  cta: { alignSelf: "stretch", marginTop: 10 },
  decline: { paddingVertical: 10 },
  declineText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
});
