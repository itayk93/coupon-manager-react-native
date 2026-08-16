import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Share2, Users, UserCheck, Plus, X, Trash2 } from "lucide-react-native";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useSharedWithMe,
  useMyShares,
  useCreateShare,
  useRevokeShare,
} from "@/hooks/useSharing";
import { useCoupons } from "@/hooks/useCoupons";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

function formatIls(value: number) {
  return `${value.toFixed(2)} ₪`;
}

export function SharingScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<"shared_with_me" | "my_shares">("shared_with_me");

  const { data: sharedWithMe = [], isLoading: loadingWithMe, refetch: refetchWithMe, isRefetching: refetchingWithMe } = useSharedWithMe();
  const { data: myShares = [], isLoading: loadingMy, refetch: refetchMy, isRefetching: refetchingMy } = useMyShares();
  const { data: coupons = [] } = useCoupons();

  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleCreateShare = async () => {
    if (!selectedCouponId) {
      notify.error("יש לבחור קופון לשיתוף");
      return;
    }
    if (!recipientEmail.trim() || !/\S+@\S+\.\S+/.test(recipientEmail)) {
      setEmailError("יש להזין כתובת אימייל תקינה של המקבל");
      return;
    }

    try {
      await createShare.mutateAsync({
        couponId: selectedCouponId,
        recipientEmail: recipientEmail.trim(),
      });
      setIsShareModalOpen(false);
      setRecipientEmail("");
      setSelectedCouponId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevoke = (shareId: number, companyName: string) => {
    notify.confirm(
      "ביטול שיתוף",
      `האם לבטל את השיתוף של קופון ${companyName}?`,
      async () => {
        await revokeShare.mutateAsync(shareId);
      },
      "בטל שיתוף"
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Text style={[styles.pageTitle, { color: theme.text }]}>שיתופים</Text>

      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab("shared_with_me")}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "shared_with_me" ? theme.card : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "shared_with_me" ? theme.text : theme.textMuted,
                },
              ]}
            >
              שותפו איתי ({sharedWithMe.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("my_shares")}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "my_shares" ? theme.card : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "my_shares" ? theme.text : theme.textMuted,
                },
              ]}
            >
              השיתופים שלי ({myShares.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refetchingWithMe || refetchingMy}
              onRefresh={() => {
                refetchWithMe();
                refetchMy();
              }}
              tintColor={theme.primary}
            />
          }
        >
          {activeTab === "shared_with_me" ? (
            sharedWithMe.length > 0 ? (
              sharedWithMe.map((item) => {
                const rem = Math.max(
                  0,
                  (item.coupon?.value || 0) - (item.coupon?.used_value || 0)
                );
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.shareCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.shareCardHeader}>
                      <View style={styles.shareBadge}>
                        <Text style={styles.shareBadgeText}>
                          שותף ע״י {item.shared_by?.first_name || item.shared_by?.email}
                        </Text>
                      </View>

                      <View style={styles.companyGroup}>
                        <Text style={[styles.companyTitle, { color: theme.text }]}>
                          {item.coupon?.company}
                        </Text>
                        <Image
                          source={getCompanyLogoSource(item.coupon?.company)}
                          style={styles.shareLogo}
                          resizeMode="contain"
                        />
                      </View>
                    </View>

                    <View style={styles.shareDetailsRow}>
                      <Text style={[styles.shareCode, { color: theme.primary }]}>
                        קוד: {item.coupon?.code}
                      </Text>
                      <Text style={[styles.shareBalance, { color: theme.text }]}>
                        יתרה: {formatIls(rem)}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <EmptyState
                icon={<Users size={32} color={theme.primary} />}
                title="אין קופונים ששותפו איתך"
                subtitle="כאשר משתמשים אחרים ישתפו איתך קופונים, הם יופיעו כאן"
              />
            )
          ) : myShares.length > 0 ? (
            myShares.map((item: any) => {
              return (
                <View
                  key={item.id}
                  style={[
                    styles.shareCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.shareCardHeader}>
                    <TouchableOpacity
                      onPress={() => handleRevoke(item.id, item.coupon?.company)}
                      style={styles.revokeBtn}
                    >
                      <Trash2 size={16} color={theme.danger} />
                      <Text style={[styles.revokeText, { color: theme.danger }]}>
                        בטל
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.companyGroup}>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.companyTitle, { color: theme.text }]}>
                          {item.coupon?.company}
                        </Text>
                        <Text style={[styles.sharedWithText, { color: theme.textMuted }]}>
                          שותף עם {item.shared_with?.email}
                        </Text>
                      </View>
                      <Image
                        source={getCompanyLogoSource(item.coupon?.company)}
                        style={styles.shareLogo}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState
              icon={<Share2 size={32} color={theme.primary} />}
              title="טרם שיתפת קופונים"
              subtitle="שתף בקלות קופונים עם חברים ובני משפחה"
              actionTitle="שתף קופון חדש"
              onAction={() => setIsShareModalOpen(true)}
            />
          )}
        </ScrollView>
      </View>

      {/* New Share Modal */}
      <Modal
        visible={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="שיתוף קופון עם חבר"
        subtitle="הזן את כתובת המייל של המשתמש ובחר קופון"
      >
        <View style={{ paddingVertical: 6 }}>
          <Input
            label="אימייל המקבל *"
            placeholder="friend@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={recipientEmail}
            onChangeText={(val: string) => {
              setRecipientEmail(val);
              setEmailError("");
            }}
            error={emailError}
          />

          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            בחר קופון לשיתוף *
          </Text>

          <ScrollView style={{ maxHeight: 220, marginBottom: 14 }}>
            {coupons.map((c) => {
              const isSelected = selectedCouponId === c.id;
              const rem = Math.max(0, (c.value || 0) - (c.used_value || 0));
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCouponId(c.id)}
                  style={[
                    styles.couponSelectRow,
                    {
                      backgroundColor: isSelected
                        ? theme.primaryMuted
                        : theme.inputBg,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.selectRem, { color: theme.primary }]}>
                    {formatIls(rem)}
                  </Text>
                  <View style={styles.selectInfo}>
                    <Text style={[styles.selectCompany, { color: theme.text }]}>
                      {c.company}
                    </Text>
                    <Image
                      source={getCompanyLogoSource(c.company)}
                      style={styles.selectLogo}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title="שלח שיתוף"
            onPress={handleCreateShare}
            loading={createShare.isPending}
          />
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  newShareBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  newShareText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  tabsRow: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
    gap: 8,
    padding: 4,
    borderRadius: radii.lg,
    marginBottom: 20,
  },
  tab: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  shareCard: {
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  shareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  companyGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  shareLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  companyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  sharedWithText: {
    fontSize: 11,
    marginTop: 2,
  },
  shareBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shareBadgeText: {
    
    fontSize: 11,
    fontWeight: "700",
  },
  shareDetailsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  shareCode: {
    fontSize: 13,
    fontWeight: "800",
  },
  shareBalance: {
    fontSize: 13,
    fontWeight: "700",
  },
  revokeBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  revokeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "right",
  },
  couponSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  selectInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  selectLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  selectCompany: {
    fontSize: 13,
    fontWeight: "700",
  },
  selectRem: {
    fontSize: 13,
    fontWeight: "800",
  },
});
