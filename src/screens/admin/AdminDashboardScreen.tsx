import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Users,
  Building2,
  Tag,
  Clock,
  Search,
  Plus,
  Trash2,
  Shield,
  Send,
  MessageSquare,
  Share2,
  MapPin,
  Mail,
} from "lucide-react-native";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { ReferralsTab } from "@/screens/admin/ReferralsTab";
import { GeoAnalyticsTab } from "@/screens/admin/GeoAnalyticsTab";
import { NewslettersTab } from "@/screens/admin/NewslettersTab";
import {
  useManageUsers,
  useCompanies,
  useUpsertCompany,
  useDeleteCompany,
  useAdminMessages,
  useCreateAdminMessage,
  useDeleteAdminMessage,
} from "@/hooks/useAdminManagement";
import { useAdminTags, useRenameTag, useDeleteTag } from "@/hooks/useTags";
import { getCompanyLogoSource } from "@/lib/companyLogos";
import { useAppTheme } from "@/contexts/ThemeContext";
import { fonts, radii, shadows } from "@/lib/theme";
import { notify } from "@/lib/notify";

type AdminTab = "users" | "companies" | "tags" | "messages" | "referrals" | "geo" | "newsletters";

const TAB_KEYS: AdminTab[] = ["users", "companies", "tags", "messages", "referrals", "geo", "newsletters"];

export function AdminDashboardScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  // The bottom bar's שותפים tab points here with ?tab=referrals. Reading it in
  // an effect rather than as the initial state matters: the screen stays
  // mounted, so a second tap must still move the tab.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (!tabParam) return;
    if (TAB_KEYS.includes(tabParam as AdminTab)) setActiveTab(tabParam as AdminTab);
  }, [tabParam]);

  // Users
  const [userSearch, setUserSearch] = useState("");
  const { data: users = [], isLoading: loadingUsers } = useManageUsers(userSearch);

  // Companies
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies();
  const upsertCompany = useUpsertCompany();
  const deleteCompany = useDeleteCompany();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyLogo, setNewCompanyLogo] = useState("");
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Tags
  const { data: tags = [], isLoading: loadingTags } = useAdminTags();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();

  // Messages
  const { data: messages = [], isLoading: loadingMessages } = useAdminMessages();
  const createMessage = useCreateAdminMessage();
  const deleteMessage = useDeleteAdminMessage();
  const [messageText, setMessageText] = useState("");

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) {
      notify.error("יש להזין שם חברה");
      return;
    }
    await upsertCompany.mutateAsync({
      name: newCompanyName.trim(),
      image_path: newCompanyLogo.trim() || "default.png",
    });
    setNewCompanyName("");
    setNewCompanyLogo("");
    setIsCompanyModalOpen(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      notify.error("יש להקליד תוכן להודעת מנהל");
      return;
    }
    await createMessage.mutateAsync({
      message_text: messageText.trim(),
    });
    setMessageText("");
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title="פאנל ניהול" showBack onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Navigation Tabs */}
        <View style={styles.tabsRow}>
          {(
            [
              { key: "users", label: "משתמשים", icon: <Users size={16} /> },
              { key: "companies", label: "חברות", icon: <Building2 size={16} /> },
              { key: "tags", label: "תגיות", icon: <Tag size={16} /> },
              { key: "messages", label: "הודעות", icon: <MessageSquare size={16} /> },
              { key: "referrals", label: "הפניות", icon: <Share2 size={16} /> },
              { key: "geo", label: "גאוגרפיה", icon: <MapPin size={16} /> },
              { key: "newsletters", label: "ניוזלטר", icon: <Mail size={16} /> },
            ] as const
          ).map((tab) => {
            const isCurrent = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: isCurrent
                      ? theme.primary
                      : theme.surfaceAlt,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: isCurrent ? "#ffffff" : theme.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 5: Referrals — the pilot dashboard. Everything it reads is
            gated by is_app_admin() inside the database, so this tab being
            hidden is a convenience and not the permission. */}
        {activeTab === "referrals" ? <ReferralsTab /> : null}

        {/* Tab 6: Geo — city/region breakdown of activity. is_app_admin() gates
            the RPC in the database; hiding the tab is just convenience. */}
        {activeTab === "geo" ? <GeoAnalyticsTab /> : null}

        {/* Tab 7: Newsletters — authoring only. Sending is never wired here;
            drafts are reviewed and sent by hand. */}
        {activeTab === "newsletters" ? <NewslettersTab /> : null}

        {/* Tab 1: Users */}
        {activeTab === "users" ? (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.inputBg, borderColor: theme.border },
              ]}
            >
              <Search size={16} color={theme.textMuted} />
              <TextInput
                placeholder="חיפוש משתמש לפי אימייל או שם..."
                placeholderTextColor={theme.textMuted}
                value={userSearch}
                onChangeText={setUserSearch}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <FlatList
              data={users}
              keyExtractor={(u: any) => String(u.id)}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }: any) => (
                <View
                  style={[
                    styles.userCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.userRoleBadge}>
                    <Text style={styles.userRoleText}>
                      {item.is_admin ? "מנהל" : "משתמש"}
                    </Text>
                  </View>

                  <View style={styles.userInfoCol}>
                    <Text style={[styles.userName, { color: theme.text }]}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={[styles.userEmail, { color: theme.textMuted }]}>
                      {item.email}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>
        ) : null}

        {/* Tab 2: Companies */}
        {activeTab === "companies" ? (
          <View style={styles.tabContent}>
            <Button
              title="הוסף חברה חדשה"
              onPress={() => setIsCompanyModalOpen(true)}
              icon={<Plus size={18} color="#ffffff" />}
              style={{ marginBottom: 12 }}
            />

            <FlatList
              data={companies}
              keyExtractor={(c) => String(c.id)}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.companyAdminRow,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      notify.confirm(
                        "מחיקת חברה",
                        `האם למחוק את חברת ${item.name}?`,
                        () => deleteCompany.mutate(item.id),
                        "מחק"
                      );
                    }}
                  >
                    <Trash2 size={16} color={theme.danger} />
                  </TouchableOpacity>

                  <View style={styles.companyAdminInfo}>
                    <Text style={[styles.companyAdminName, { color: theme.text }]}>
                      {item.name}
                    </Text>
                    <Image
                      source={getCompanyLogoSource(item.name)}
                      style={styles.adminLogo}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              )}
            />
          </View>
        ) : null}

        {/* Tab 3: Tags */}
        {activeTab === "tags" ? (
          <View style={styles.tabContent}>
            <FlatList
              data={tags}
              keyExtractor={(t) => String(t.id)}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.tagAdminRow,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      notify.confirm(
                        "מחיקת תגית",
                        `האם למחוק את התגית #${item.name}?`,
                        () => deleteTag.mutate(item.id),
                        "מחק"
                      );
                    }}
                  >
                    <Trash2 size={16} color={theme.danger} />
                  </TouchableOpacity>

                  <Text style={[styles.tagAdminName, { color: theme.primary }]}>
                    #{item.name} ({item.count || 0} קופונים)
                  </Text>
                </View>
              )}
            />
          </View>
        ) : null}

        {/* Tab 4: Messages */}
        {activeTab === "messages" ? (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.broadcastBox,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <Input
                label="שליחת הודעת מערכת (Broadcast)"
                placeholder="הקלד הודעה לכל המשתמשים..."
                value={messageText}
                onChangeText={setMessageText}
              />
              <Button
                title="שלח הודעה"
                onPress={handleSendMessage}
                loading={createMessage.isPending}
                icon={<Send size={16} color="#ffffff" />}
              />
            </View>

            <FlatList
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => deleteMessage.mutate(item.id)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Trash2 size={16} color={theme.danger} />
                  </TouchableOpacity>
                  <Text style={[styles.msgText, { color: theme.text }]}>
                    {item.message_text}
                  </Text>
                  <Text style={[styles.msgDate, { color: theme.textMuted }]}>
                    {new Date(item.created_at || Date.now()).toLocaleDateString("he-IL")}
                  </Text>
                </View>
              )}
            />
          </View>
        ) : null}
      </View>

      {/* Add Company Modal */}
      <Modal
        visible={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        title="הוספת חברה / רשת חדשה"
      >
        <View style={{ paddingVertical: 6 }}>
          <Input
            label="שם החברה *"
            placeholder="למשל: סופר פארם"
            value={newCompanyName}
            onChangeText={setNewCompanyName}
          />
          <Input
            label="שם קובץ לוגו / קישור"
            placeholder="super_pharm.png או https://..."
            value={newCompanyLogo}
            onChangeText={setNewCompanyLogo}
          />
          <Button
            title="שמור חברה"
            onPress={handleAddCompany}
            loading={upsertCompany.isPending}
            style={{ marginTop: 10 }}
          />
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
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tabsRow: {
    flexDirection: "row-reverse",
    gap: 6,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  tabContent: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  userInfoCol: {
    alignItems: "flex-end",
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  userRoleBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  userRoleText: {
    
    fontSize: 11,
    fontWeight: "700",
  },
  companyAdminRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  companyAdminInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  adminLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  companyAdminName: {
    fontSize: 14,
    fontWeight: "700",
  },
  tagAdminRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  tagAdminName: {
    fontSize: 14,
    fontWeight: "700",
  },
  broadcastBox: {
    padding: 16,
    borderRadius: radii.cardLg,
    borderWidth: 1,
    marginBottom: 14,
  },
  messageCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  msgText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "right",
  },
  msgDate: {
    fontSize: 11,
    marginTop: 4,
  },
});
