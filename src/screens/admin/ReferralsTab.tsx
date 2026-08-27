import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { RefreshCw, Search } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useAppTheme } from "@/contexts/ThemeContext";
import {
  ReferralRow,
  summarizeReferrals,
  useMarkRewardPaid,
  useReferralCampaigns,
  useReferralRewards,
  useReferralRows,
  useRefreshReferralProgress,
  useSetReferralFraudStatus,
} from "@/hooks/useReferralAdmin";
import { fonts, radii } from "@/lib/theme";

/**
 * The referral pilot, seen from the inside.
 *
 * Two things this screen deliberately does not do. It never moves money: a
 * reward that has been earned is marked as *delivered* by hand, after the
 * Dream Card or the transfer has actually gone out, so a bug here can only
 * ever produce a wrong number on a screen. And it never deletes a referral —
 * a rejected one keeps its row, because "why did this person not count" is a
 * question that gets asked weeks later.
 */

const FILTERS = [
  { key: "all", label: "הכל" },
  { key: "registered", label: "הצטרפו" },
  { key: "activated", label: "הופעלו" },
  { key: "retained", label: "נשארו" },
  { key: "review", label: "לבדיקה" },
  { key: "rejected", label: "נפסלו" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const FRAUD_LABELS: Record<string, string> = {
  duplicate_install: "כמה חשבונות מאותה התקנה",
  reciprocal_referral: "הפניה הדדית",
  ip_burst: "ריבוי הרשמות מאותו IP",
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  registered: { label: "הצטרף", color: "#94a3b8" },
  activated: { label: "הופעל", color: "#0ea5e9" },
  retained: { label: "נשאר", color: "#10b981" },
};

export function ReferralsTab() {
  const { theme } = useAppTheme();

  const { data: campaigns = [], isLoading: loadingCampaigns } = useReferralCampaigns();
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const activeCampaignId = campaignId ?? campaigns[0]?.id ?? null;

  const { data: rows = [], isLoading: loadingRows } = useReferralRows(activeCampaignId);
  const { data: rewards = [] } = useReferralRewards(activeCampaignId);

  const refresh = useRefreshReferralProgress();
  const setFraud = useSetReferralFraudStatus();
  const markPaid = useMarkRewardPaid();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReferralRow | null>(null);
  const [payingRewardId, setPayingRewardId] = useState<number | null>(null);
  const [payNote, setPayNote] = useState("");

  const summary = useMemo(() => summarizeReferrals(rows), [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "review" || filter === "rejected"
          ? row.fraud_status === filter
          : row.status === filter && row.fraud_status !== "rejected");
      if (!matchesFilter) return false;
      if (!needle) return true;
      return (
        row.referred_email?.toLowerCase().includes(needle) ||
        row.referred_name?.toLowerCase().includes(needle) ||
        row.referrer_name?.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, search]);

  if (loadingCampaigns) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!campaigns.length) {
    return (
      <View style={styles.center}>
        <Text style={[styles.muted, { color: theme.textMuted }]}>אין קמפיין הפניות פעיל.</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={visible}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {campaigns.length > 1 ? (
              <View style={styles.chipRow}>
                {campaigns.map((campaign) => (
                  <TouchableOpacity
                    key={campaign.id}
                    onPress={() => setCampaignId(campaign.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          campaign.id === activeCampaignId ? theme.primary : theme.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: campaign.id === activeCampaignId ? "#fff" : theme.textMuted },
                      ]}
                    >
                      {campaign.partner_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.cardHead}>
                <TouchableOpacity
                  onPress={() => refresh.mutate({ campaignId: activeCampaignId })}
                  disabled={refresh.isPending}
                  style={styles.refreshBtn}
                >
                  <RefreshCw size={16} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {campaigns.find((c) => c.id === activeCampaignId)?.partner_name} · קוד{" "}
                  {campaigns.find((c) => c.id === activeCampaignId)?.code}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Summary label="הצטרפו" value={summary.joined} theme={theme} />
                <Summary label="הופעלו" value={summary.activated} theme={theme} />
                <Summary label="נשארו" value={summary.retained} theme={theme} />
                <Summary label="לבדיקה" value={summary.review} theme={theme} tint="#f59e0b" />
                <Summary label="נפסלו" value={summary.rejected} theme={theme} tint={theme.danger} />
              </View>
            </View>

            {rewards.map((reward) => {
              const current = reward.metric === "activated" ? summary.activated : summary.retained;
              const ratio = Math.min(1, current / reward.threshold);
              return (
                <View
                  key={reward.id}
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <Text style={[styles.rewardTitle, { color: theme.text }]}>{reward.label}</Text>
                  <Text style={[styles.rewardMeta, { color: theme.textMuted }]}>
                    {reward.reward_type === "cash" ? "מזומן" : "Dream Card"} · {reward.reward_value} ₪
                  </Text>

                  <View style={[styles.progressTrack, { backgroundColor: theme.surfaceAlt }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${ratio * 100}%`,
                          backgroundColor: reward.earned_at ? "#10b981" : theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.rewardMeta, { color: theme.textMuted }]}>
                    {current}/{reward.threshold}
                    {reward.paid_at
                      ? ` · נמסר${reward.paid_note ? ` (${reward.paid_note})` : ""}`
                      : reward.earned_at
                        ? " · הושג, ממתין למסירה"
                        : ""}
                  </Text>

                  {reward.earned_at && !reward.paid_at ? (
                    <Button
                      title="סמן כנמסר"
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setPayNote("");
                        setPayingRewardId(reward.id);
                      }}
                      style={{ marginTop: 8 }}
                    />
                  ) : null}
                </View>
              );
            })}

            <View style={styles.chipRow}>
              {FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        filter === option.key ? theme.primary : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: filter === option.key ? "#fff" : theme.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View
              style={[styles.searchBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            >
              <Search size={16} color={theme.textMuted} />
              <TextInput
                placeholder="חיפוש לפי שם או אימייל..."
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            {loadingRows ? <ActivityIndicator color={theme.primary} /> : null}
          </View>
        }
        ListEmptyComponent={
          loadingRows ? null : (
            <Text style={[styles.muted, { color: theme.textMuted, marginTop: 24 }]}>
              אין משתמשים שתואמים את הסינון.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelected(item)}
            style={[styles.row, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          >
            <View style={styles.rowBadges}>
              <Text style={[styles.badge, { color: STATUS_BADGE[item.status]?.color }]}>
                {STATUS_BADGE[item.status]?.label}
              </Text>
              {item.fraud_status !== "normal" ? (
                <Text
                  style={[
                    styles.badge,
                    { color: item.fraud_status === "rejected" ? theme.danger : "#f59e0b" },
                  ]}
                >
                  {item.fraud_status === "rejected" ? "נפסל" : "לבדיקה"}
                </Text>
              ) : null}
            </View>

            <View style={styles.rowMain}>
              <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                {item.referred_name || item.referred_email}
              </Text>
              <Text style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {item.referrer_name ? `הופנה ע"י ${item.referrer_name}` : "הגיע ישירות"} · עומק{" "}
                {item.depth} · {item.coupon_count} קופונים · {item.active_days_first_30}/3 ימים
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.referred_name || selected?.referred_email}
        subtitle={selected?.referred_email}
      >
        {selected ? (
          <View style={{ gap: 10 }}>
            <Detail label="קוד הפניה" value={selected.referral_code} theme={theme} />
            <Detail
              label={'הופנה ע"י'}
              value={selected.referrer_name || "ישירות מהשותף"}
              theme={theme}
            />
            <Detail label="עומק בשרשרת" value={String(selected.depth)} theme={theme} />
            <Detail label="נרשם" value={formatDate(selected.registered_at)} theme={theme} />
            <Detail label="קופון ראשון" value={formatDate(selected.first_coupon_at)} theme={theme} />
            <Detail label="קופונים בחשבון" value={String(selected.coupon_count)} theme={theme} />
            <Detail
              label="ימי פעילות (30 ימים ראשונים)"
              value={`${selected.active_days_first_30} מתוך 3 הנדרשים`}
              theme={theme}
            />
            <Detail
              label="ימי פעילות (ימים 31-60)"
              value={`${selected.active_days_31_60} מתוך 2 הנדרשים`}
              theme={theme}
            />
            <Detail label="הופעל" value={formatDate(selected.activated_at)} theme={theme} />
            <Detail label="נשאר" value={formatDate(selected.retained_at)} theme={theme} />

            {selected.fraud_reasons?.length ? (
              <Detail
                label="דגלים"
                value={selected.fraud_reasons.map((r) => FRAUD_LABELS[r] ?? r).join(", ")}
                theme={theme}
              />
            ) : null}
            {selected.review_note ? (
              <Detail label="הערת בדיקה" value={selected.review_note} theme={theme} />
            ) : null}

            <View style={styles.actionRow}>
              <Button
                title="תקין"
                size="sm"
                variant="outline"
                onPress={() => {
                  setFraud.mutate({ id: selected.id, status: "normal" });
                  setSelected(null);
                }}
              />
              <Button
                title="לבדיקה"
                size="sm"
                variant="warning"
                onPress={() => {
                  setFraud.mutate({ id: selected.id, status: "review" });
                  setSelected(null);
                }}
              />
              <Button
                title="פסול"
                size="sm"
                variant="danger"
                onPress={() => {
                  setFraud.mutate({ id: selected.id, status: "rejected" });
                  setSelected(null);
                }}
              />
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={payingRewardId !== null}
        onClose={() => setPayingRewardId(null)}
        title="סימון הטבה כנמסרה"
        subtitle="הסימון מתעד בלבד — את ההטבה עצמה מעבירים ידנית"
      >
        <TextInput
          placeholder="מספר Dream Card / אסמכתא"
          placeholderTextColor={theme.textMuted}
          value={payNote}
          onChangeText={setPayNote}
          style={[
            styles.noteInput,
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
          ]}
        />
        <Button
          title="סמן כנמסר"
          onPress={() => {
            if (payingRewardId !== null) {
              markPaid.mutate({ id: payingRewardId, note: payNote.trim() || null });
            }
            setPayingRewardId(null);
          }}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </View>
  );
}

function Summary({
  label,
  value,
  theme,
  tint,
}: {
  label: string;
  value: number;
  theme: any;
  tint?: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color: tint ?? theme.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function Detail({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const styles = StyleSheet.create({
  tabContent: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },

  card: { borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
  refreshBtn: { padding: 6 },

  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8 },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontFamily: fonts.display, fontSize: 20 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 11, textAlign: "center" },

  rewardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right" },
  rewardMeta: { fontFamily: fonts.body, fontSize: 12, textAlign: "right" },
  progressTrack: { height: 8, borderRadius: radii.pill, overflow: "hidden", marginVertical: 6 },
  progressFill: { height: "100%", borderRadius: radii.pill },

  chipRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radii.pill },
  chipText: { fontFamily: fonts.body, fontSize: 12 },

  searchBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, textAlign: "right" },

  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 8,
  },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 14, textAlign: "right" },
  rowMeta: { fontFamily: fonts.body, fontSize: 11, textAlign: "right" },
  rowBadges: { alignItems: "flex-start", gap: 2 },
  badge: { fontFamily: fonts.bodyBold, fontSize: 11 },

  detailRow: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 12 },
  detailLabel: { fontFamily: fonts.body, fontSize: 12 },
  detailValue: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "left", flexShrink: 1 },

  actionRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  noteInput: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    textAlign: "right",
  },
});
