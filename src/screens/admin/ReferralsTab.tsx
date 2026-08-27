import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ChevronRight, Copy, Plus, RefreshCw, Search, Share2, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useAppTheme } from "@/contexts/ThemeContext";
import {
  ReferralCampaignOverview,
  ReferralRow,
  summarizeReferrals,
  useCreateReferralCampaign,
  useDeleteReferralReward,
  useMarkRewardPaid,
  useReferralCampaignOverview,
  useReferralRewards,
  useReferralRows,
  useRefreshReferralProgress,
  useSetCampaignActive,
  useSetReferralFraudStatus,
  useUpsertReferralReward,
} from "@/hooks/useReferralAdmin";
import { referralShareMessage, referralUrl } from "@/lib/referral";
import { fonts, radii } from "@/lib/theme";
import { notify } from "@/lib/notify";

/**
 * The referral pilots, seen from the inside.
 *
 * Two levels, because there is rarely one partner. The list is every deal at a
 * glance — who is bringing people and who has gone quiet — and opening one
 * gives that partner's ladder and the individual people underneath them.
 *
 * Two things this screen deliberately does not do. It never moves money: a
 * reward that has been earned is marked as *delivered* by hand, after the
 * Dream Card or the transfer has actually gone out, so a bug here can only
 * ever produce a wrong number on a screen. And it never deletes a referral —
 * a rejected one keeps its row, because "why did this person not count" is a
 * question that gets asked weeks later.
 */

const APP_BASE_URL = "https://coupons.itaykarkason.com";

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
  const [openCampaignId, setOpenCampaignId] = useState<number | null>(null);

  return openCampaignId === null ? (
    <PartnerList onOpen={setOpenCampaignId} />
  ) : (
    <PartnerDetail campaignId={openCampaignId} onBack={() => setOpenCampaignId(null)} />
  );
}

/* ------------------------------------------------------------------ list */

function PartnerList({ onOpen }: { onOpen: (id: number) => void }) {
  const { theme } = useAppTheme();
  const { data: partners = [], isLoading } = useReferralCampaignOverview();
  const createCampaign = useCreateReferralCampaign();
  const refresh = useRefreshReferralProgress();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  // Held after creation so the link can be handed over immediately — the code
  // is the whole deliverable, and going back to look it up is a step nobody
  // should have to take.
  const [issued, setIssued] = useState<{ code: string; partnerName: string } | null>(null);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={partners}
        keyExtractor={(partner) => String(partner.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Button
              title="שותף חדש"
              icon={<Plus size={18} color="#ffffff" />}
              onPress={() => {
                setName("");
                setCode("");
                setNotes("");
                setIsCreating(true);
              }}
            />
            <TouchableOpacity
              onPress={() => refresh.mutate({ campaignId: null })}
              disabled={refresh.isPending}
              style={styles.refreshRow}
            >
              <RefreshCw size={14} color={theme.textMuted} />
              <Text style={[styles.refreshText, { color: theme.textMuted }]}>
                חשב מחדש את כל הקמפיינים
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.muted, { color: theme.textMuted, marginTop: 24 }]}>
            עדיין אין שותפים. "שותף חדש" מנפיק קישור.
          </Text>
        }
        renderItem={({ item }) => (
          <PartnerCard partner={item} onOpen={() => onOpen(item.id)} />
        )}
      />

      <Modal
        visible={isCreating}
        onClose={() => setIsCreating(false)}
        title="שותף חדש"
        subtitle="שם השותף, ואם רוצים גם קוד קריא. הקוד הוא הקישור."
      >
        <View style={{ gap: 10 }}>
          <Field label="שם השותף" value={name} onChange={setName} placeholder="אליאור" />
          <Field
            label="קוד (אופציונלי)"
            value={code}
            onChange={(text) => setCode(text.toUpperCase())}
            placeholder="נוצר אוטומטית אם ריק"
            autoCapitalize="characters"
          />
          <Field label="הערה (אופציונלי)" value={notes} onChange={setNotes} placeholder="תנאי העסקה" />
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            הקמפיין נפתח עם היעדים הרגילים — 10 ו-25 מופעלים, ו-25 שנשארו. אפשר לשנות
            אותם אחרי זה בכרטיס של השותף.
          </Text>
          <Button
            title="צור והנפק קישור"
            loading={createCampaign.isPending}
            onPress={() =>
              createCampaign.mutate(
                { partnerName: name, code, notes },
                {
                  onSuccess: (created) => {
                    setIsCreating(false);
                    setIssued({ code: created.code, partnerName: name.trim() });
                  },
                },
              )
            }
          />
        </View>
      </Modal>

      <Modal
        visible={issued !== null}
        onClose={() => setIssued(null)}
        title="הקישור מוכן"
        subtitle={issued ? `שלח אותו ל${issued.partnerName}` : undefined}
      >
        {issued ? <IssuedLink code={issued.code} /> : null}
      </Modal>
    </View>
  );
}

function PartnerCard({
  partner,
  onOpen,
}: {
  partner: ReferralCampaignOverview;
  onOpen: () => void;
}) {
  const { theme } = useAppTheme();
  const link = referralUrl(APP_BASE_URL, partner.code);

  return (
    <TouchableOpacity
      onPress={onOpen}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, marginTop: 10 }]}
    >
      <View style={styles.cardHead}>
        <ChevronRight size={18} color={theme.textMuted} />
        <View style={styles.partnerTitleGroup}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{partner.partner_name}</Text>
          {!partner.active ? (
            <Text style={[styles.inactiveTag, { color: theme.textMuted }]}>לא פעיל</Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        onPress={async () => {
          await Clipboard.setStringAsync(link);
          notify.success("הקישור הועתק");
        }}
        style={styles.linkRow}
      >
        <Copy size={14} color={theme.textMuted} />
        <Text style={[styles.link, { color: theme.textMuted }]} numberOfLines={1}>
          {link}
        </Text>
      </TouchableOpacity>

      <View style={styles.summaryRow}>
        <Summary label="הצטרפו" value={partner.joined} theme={theme} />
        <Summary label="הופעלו" value={partner.activated} theme={theme} />
        <Summary label="נשארו" value={partner.retained} theme={theme} />
        {partner.in_review ? (
          <Summary label="לבדיקה" value={partner.in_review} theme={theme} tint="#f59e0b" />
        ) : null}
        {partner.rejected ? (
          <Summary label="נפסלו" value={partner.rejected} theme={theme} tint={theme.danger} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function IssuedLink({ code }: { code: string }) {
  const { theme } = useAppTheme();
  const link = referralUrl(APP_BASE_URL, code);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.code, { color: theme.text }]}>{code}</Text>
      <Text style={[styles.link, { color: theme.textMuted, textAlign: "center" }]}>{link}</Text>
      <Button
        title="שיתוף"
        icon={<Share2 size={18} color="#ffffff" />}
        onPress={() =>
          Share.share({ message: referralShareMessage(APP_BASE_URL, code) }).catch(() => {})
        }
      />
      <Button
        title="העתקה"
        variant="outline"
        onPress={async () => {
          await Clipboard.setStringAsync(link);
          notify.success("הקישור הועתק");
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- detail */

function PartnerDetail({ campaignId, onBack }: { campaignId: number; onBack: () => void }) {
  const { theme } = useAppTheme();

  const { data: partners = [] } = useReferralCampaignOverview();
  const partner = partners.find((entry) => entry.id === campaignId);

  const { data: rows = [], isLoading: loadingRows } = useReferralRows(campaignId);
  const { data: rewards = [] } = useReferralRewards(campaignId);

  const refresh = useRefreshReferralProgress();
  const setFraud = useSetReferralFraudStatus();
  const markPaid = useMarkRewardPaid();
  const setActive = useSetCampaignActive();
  const upsertReward = useUpsertReferralReward();
  const deleteReward = useDeleteReferralReward();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReferralRow | null>(null);
  const [payingRewardId, setPayingRewardId] = useState<number | null>(null);
  const [payNote, setPayNote] = useState("");
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [rewardMetric, setRewardMetric] = useState<"activated" | "retained">("activated");
  const [rewardType, setRewardType] = useState<"dream_card" | "cash">("dream_card");
  const [rewardThreshold, setRewardThreshold] = useState("");
  const [rewardValue, setRewardValue] = useState("");

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

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={visible}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <TouchableOpacity onPress={onBack} style={styles.backRow}>
              <Text style={[styles.backText, { color: theme.primary }]}>כל השותפים ›</Text>
            </TouchableOpacity>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.cardHead}>
                <TouchableOpacity
                  onPress={() => refresh.mutate({ campaignId })}
                  disabled={refresh.isPending}
                  style={styles.refreshBtn}
                >
                  <RefreshCw size={16} color={theme.textMuted} />
                </TouchableOpacity>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {partner?.partner_name} · קוד {partner?.code}
                </Text>
              </View>

              {partner ? <IssuedLink code={partner.code} /> : null}

              <View style={styles.summaryRow}>
                <Summary label="הצטרפו" value={summary.joined} theme={theme} />
                <Summary label="הופעלו" value={summary.activated} theme={theme} />
                <Summary label="נשארו" value={summary.retained} theme={theme} />
                <Summary label="לבדיקה" value={summary.review} theme={theme} tint="#f59e0b" />
                <Summary label="נפסלו" value={summary.rejected} theme={theme} tint={theme.danger} />
              </View>

              <View style={styles.activeRow}>
                <Switch
                  value={Boolean(partner?.active)}
                  onValueChange={(value) => setActive.mutate({ id: campaignId, active: value })}
                />
                <Text style={[styles.activeLabel, { color: theme.textMuted }]}>
                  קישור פעיל — כיבוי עוצר שיוך של אנשים חדשים, ולא מוחק את מי שכבר נספר
                </Text>
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
                  <View style={styles.cardHead}>
                    {!reward.earned_at ? (
                      <TouchableOpacity onPress={() => deleteReward.mutate({ id: reward.id })}>
                        <Trash2 size={15} color={theme.danger} />
                      </TouchableOpacity>
                    ) : (
                      <View />
                    )}
                    <Text style={[styles.rewardTitle, { color: theme.text }]}>{reward.label}</Text>
                  </View>
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

            <Button
              title="הוסף יעד"
              size="sm"
              variant="outline"
              icon={<Plus size={16} color={theme.primary} />}
              onPress={() => {
                setRewardThreshold("");
                setRewardValue("");
                setIsAddingReward(true);
              }}
            />

            <View style={styles.chipRow}>
              {FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.chip,
                    { backgroundColor: filter === option.key ? theme.primary : theme.surfaceAlt },
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

      <Modal
        visible={isAddingReward}
        onClose={() => setIsAddingReward(false)}
        title="יעד חדש"
        subtitle="לכל שותף אפשר לסכם תנאים אחרים"
      >
        <View style={{ gap: 10 }}>
          <Choice
            label="נמדד לפי"
            options={[
              { key: "activated", label: "משתמשים מופעלים" },
              { key: "retained", label: "משתמשים שנשארו" },
            ]}
            value={rewardMetric}
            onChange={(value) => setRewardMetric(value as "activated" | "retained")}
          />
          <Choice
            label="סוג ההטבה"
            options={[
              { key: "dream_card", label: "Dream Card" },
              { key: "cash", label: "מזומן" },
            ]}
            value={rewardType}
            onChange={(value) => setRewardType(value as "dream_card" | "cash")}
          />
          <Field
            label="כמה משתמשים"
            value={rewardThreshold}
            onChange={setRewardThreshold}
            placeholder="10"
            keyboardType="number-pad"
          />
          <Field
            label="שווי בשקלים"
            value={rewardValue}
            onChange={setRewardValue}
            placeholder="50"
            keyboardType="number-pad"
          />
          <Button
            title="שמור יעד"
            onPress={() => {
              const threshold = Number(rewardThreshold);
              const value = Number(rewardValue);
              if (!Number.isInteger(threshold) || threshold < 1 || !Number.isFinite(value) || value <= 0) {
                notify.error("יש להזין מספר משתמשים ושווי תקינים");
                return;
              }
              upsertReward.mutate({
                campaignId,
                metric: rewardMetric,
                threshold,
                rewardType,
                rewardValue: value,
              });
              setIsAddingReward(false);
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

/* ----------------------------------------------------------------- parts */

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: "number-pad";
  autoCapitalize?: "characters";
}) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          styles.noteInput,
          { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
        ]}
      />
    </View>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              { backgroundColor: value === option.key ? theme.primary : theme.surfaceAlt },
            ]}
          >
            <Text
              style={[styles.chipText, { color: value === option.key ? "#fff" : theme.textMuted }]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  hint: { fontFamily: fonts.body, fontSize: 12, textAlign: "right", lineHeight: 18 },

  card: { borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
  partnerTitleGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  inactiveTag: { fontFamily: fonts.body, fontSize: 11 },
  refreshBtn: { padding: 6 },
  refreshRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6 },
  refreshText: { fontFamily: fonts.body, fontSize: 12 },
  backRow: { paddingVertical: 4 },
  backText: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "right" },

  linkRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  link: { fontFamily: fonts.body, fontSize: 12, flexShrink: 1 },
  code: { fontFamily: fonts.display, fontSize: 32, letterSpacing: 4, textAlign: "center" },

  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8 },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontFamily: fonts.display, fontSize: 20 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 11, textAlign: "center" },

  activeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 8 },
  activeLabel: { fontFamily: fonts.body, fontSize: 11, flex: 1, textAlign: "right", lineHeight: 16 },

  rewardTitle: { fontFamily: fonts.bodyBold, fontSize: 15, textAlign: "right" },
  rewardMeta: { fontFamily: fonts.body, fontSize: 12, textAlign: "right" },
  progressTrack: { height: 8, borderRadius: radii.pill, overflow: "hidden", marginVertical: 6 },
  progressFill: { height: "100%", borderRadius: radii.pill },

  chipRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radii.pill },
  chipText: { fontFamily: fonts.body, fontSize: 12 },

  fieldLabel: { fontFamily: fonts.body, fontSize: 12, textAlign: "right" },

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
