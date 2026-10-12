import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, Switch } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { fonts } from '@/lib/theme';
import { instinctGuide } from '@/lib/instinctGuide';
import { notify } from '@/lib/notify';

type KeyRecord = { id: string; user_id: number; label: string; key_prefix: string; created_at: string; expires_at: string; revoked_at: string | null; last_used_at: string | null; users: { email: string; first_name: string; last_name: string } };
async function manage<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-instinct-keys', { body });
  if (error) {
    if (error.context instanceof Response) {
      const response = await error.context.json();
      throw new Error(response.error || 'לא ניתן להשלים את הפעולה');
    }
    throw error;
  }
  return data as T;
}
const baseUrl = `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/instinct-api`;

export function InstinctApiTab() {
  const { theme } = useAppTheme();
  const client = useQueryClient();
  const { user } = useAuth();
  const email = user?.email || '';
  const [consent, setConsent] = useState(false);
  const [label, setLabel] = useState('Instinct');
  const [days, setDays] = useState(30);
  const [issued, setIssued] = useState<{ key: string; id: string; email: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [testResult, setTestResult] = useState('');
  const keys = useQuery({ queryKey: ['instinct-api-keys'], queryFn: () => manage<{ keys: KeyRecord[] }>({ action: 'list' }) });
  const create = useMutation({ gcTime: 0, mutationFn: () => manage<{ key: string; record: KeyRecord }>({ action: 'create', email, label, days, consent, consent_version: 'instinct-decrypted-v1' }),
    onSuccess: data => { test.reset(); setConsent(false); setIssued({ key: data.key, id: data.record.id, email: email.trim() }); setTestResult(''); void client.invalidateQueries({ queryKey: ['instinct-api-keys'] }); } });
  const revoke = useMutation({ mutationFn: (id: string) => manage({ action: 'revoke', id }),
    onSuccess: (_, id) => { if (issued?.id === id) { setIssued(null); create.reset(); } setConfirmRevoke(null); void client.invalidateQueries({ queryKey: ['instinct-api-keys'] }); } });
  const test = useMutation({ mutationFn: async () => {
    if (!issued) throw new Error('אין מפתח לבדיקה');
    const response = await fetch(`${baseUrl}/schema`, { headers: { Authorization: `Bearer ${issued.key}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'החיבור נכשל');
    return data.tables.length as number;
  }, onSuccess: count => setTestResult(`החיבור תקין. ${count} טבלאות זמינות למשתמש שנבחר.`) });
  const copy = async (value: string) => { try { await Clipboard.setStringAsync(value); notify.success('הועתק'); } catch { notify.error('ההעתקה נכשלה. אפשר לסמן ולהעתיק ידנית.'); } };
  const guide = instinctGuide(baseUrl);
  const download = () => {
    if (Platform.OS !== 'web') { void copy(guide); return; }
    const url = URL.createObjectURL(new Blob(['\uFEFF', guide], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'coupon-master-instinct-guide.md'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const text = [styles.text, { color: theme.text }];
  const muted = [styles.text, { color: theme.textMuted }];
  const card = [styles.card, { backgroundColor: theme.card, borderColor: theme.border }];
  const field = [styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }];
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={card}>
      <Text style={[styles.title, { color: theme.text }]}>חיבור ל-Instinct</Text>
      <Text style={muted}>החיבור זמין כרגע רק למנהל הראשי (משתמש 1), ורק לנתונים שלו.</Text>
      <Text style={muted}>הגישה כוללת קופונים ויתרות, שימושים ועסקאות, תגיות, חברות ופרופיל. קודים, תיאורים, CVV וקישורי מימוש יועברו מפוענחים לאחר האישור שלך. סיסמאות ומפתחות מערכת לא נחשפים.</Text>
      <Text style={text}>החשבון שלי</Text>
      <TextInput accessibilityLabel="החשבון שלי" value={email} editable={false} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor={theme.textMuted} style={field} />
      <Text style={text}>שם למפתח</Text>
      <TextInput accessibilityLabel="שם למפתח" value={label} onChangeText={setLabel} maxLength={100} style={field} />
      <Text style={text}>תוקף המפתח</Text>
      <View style={styles.actions}>{[7,30,90].map(value => <Button key={value} title={`${value} ימים${days === value ? ' - נבחר' : ''}`} size="sm" variant={days === value ? 'primary' : 'outline'} onPress={() => setDays(value)} />)}</View>
      <View style={styles.actions}><Switch accessibilityLabel="אישור שיתוף הנתונים שלי עם Instinct" value={consent} onValueChange={setConsent} /><Text style={[...text, { flex: 1 }]}>אני נותן הסכמה לגישה של Instinct לנתונים שלי, כולל פרטי קופונים מפוענחים וקודי מימוש. המפתח מאפשר גישה עד ביטולו או פקיעת תוקפו.</Text></View>
      <Button title="יצירת מפתח API" onPress={() => create.mutate()} loading={create.isPending} disabled={!consent || !email.trim() || !label.trim() || !!issued} />
      {create.error ? <Text accessibilityRole="alert" style={[styles.text, { color: theme.danger }]}>{create.error.message}</Text> : null}
    </View>
    {issued ? <View style={card}>
      <Text style={[styles.title, { color: theme.text }]}>המפתח נוצר עבור {issued.email}</Text>
      <Text style={muted}>המפתח מוצג עכשיו בלבד. Instinct לא יכול לקרוא מפתח שנשמר בכספת שלו לצורך קריאת API, לכן יש להעתיק את ״מדריך עם המפתח״ ולהדביק אותו ל-Instinct כהוראה. לאחר סגירת התיבה לא ניתן לשחזר אותו.</Text>
      <Text selectable style={[styles.key, { color: theme.text }]}>{issued.key}</Text>
      <View style={styles.actions}>
        <Button title="העתקת המפתח" onPress={() => void copy(issued.key)} />
        <Button title="העתקת מדריך עם המפתח" onPress={() => void copy(instinctGuide(baseUrl, issued.key))} />
        <Button title="בדיקת חיבור" variant="outline" onPress={() => test.mutate()} loading={test.isPending} />
        <Button title="המפתח נשמר - סגירה" variant="ghost" onPress={() => { setIssued(null); create.reset(); test.reset(); setTestResult(''); }} />
      </View>
      {testResult ? <Text style={text}>{testResult}</Text> : null}
      {test.error ? <Text accessibilityRole="alert" style={[styles.text, { color: theme.danger }]}>{test.error.message}</Text> : null}
    </View> : null}
    <View style={card}>
      <Text style={[styles.title, { color: theme.text }]}>מה לשלוח ל-Instinct</Text>
      <Text style={text}>1. הורדת המדריך והעלאת הקובץ ל-Instinct.</Text>
      <Text style={text}>2. אחרי יצירת מפתח: ״העתקת מדריך עם המפתח״ והדבקה ב-Instinct (לא בכספת).</Text>
      <Text style={text}>3. בקשה לדוגמה: ״בדוק את הקופונים שלי וסכם יתרות וקופונים שעומדים לפוג״.</Text>
      <Text style={muted}>המדריך כולל את כתובת החיבור, כל אפשרויות השאילתות ודוגמאות. הוא אינו מכיל מפתח סודי.</Text>
      <View style={styles.actions}><Button title={Platform.OS === 'web' ? 'הורדת מדריך ל-Instinct' : 'העתקת מדריך ל-Instinct'} onPress={download} /><Button title="העתקת המדריך" variant="outline" onPress={() => void copy(guide)} /></View>
      <Text selectable style={[styles.key, { color: theme.textMuted }]}>{baseUrl}</Text>
    </View>
    <Text style={[styles.title, { color: theme.text }]}>מפתחות שנוצרו</Text>
    {keys.isPending ? <Text style={text}>טעינת מפתחות...</Text> : null}
    {keys.error ? <View style={card}><Text accessibilityRole="alert" style={text}>{keys.error.message}</Text><Button title="ניסיון נוסף" onPress={() => void keys.refetch()} /></View> : null}
    {keys.data?.keys.length === 0 ? <Text style={muted}>עדיין לא נוצרו מפתחות. אפשר ליצור את הראשון למעלה.</Text> : null}
    {revoke.error ? <Text accessibilityRole="alert" style={[styles.text, { color: theme.danger }]}>{revoke.error.message}</Text> : null}
    {keys.data?.keys.map(key => {
      const active = !key.revoked_at && Date.parse(key.expires_at) > Date.now();
      return <View key={key.id} style={card}>
        <Text style={text}>{key.label} - {key.users.email}</Text>
        <Text style={muted}>{key.revoked_at ? 'בוטל' : active ? 'פעיל' : 'פג תוקף'} | תוקף: {new Date(key.expires_at).toLocaleDateString('he-IL')}</Text>
        <Text style={muted}>שימוש אחרון: {key.last_used_at ? new Date(key.last_used_at).toLocaleString('he-IL') : 'טרם נעשה שימוש'}</Text>
        <Text selectable style={[styles.key, { color: theme.textMuted }]}>{key.key_prefix}...</Text>
        {active ? confirmRevoke === key.id ? <><Text style={text}>ביטול המפתח ינתק מיד את הגישה של Instinct. להמשיך?</Text><View style={styles.actions}><Button title="ביטול המפתח לצמיתות" variant="danger" onPress={() => revoke.mutate(key.id)} loading={revoke.isPending} /><Button title="חזרה" variant="outline" onPress={() => setConfirmRevoke(null)} /></View></> : <Button title="ביטול גישה" variant="outline" onPress={() => setConfirmRevoke(key.id)} /> : null}
      </View>;
    })}
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { paddingVertical: 20, paddingBottom: 100, gap: 16 },
  card: { padding: 20, borderWidth: 1, borderRadius: 18, gap: 12 },
  title: { fontFamily: fonts.bodyBold, fontSize: 21, textAlign: 'right' },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'right' },
  input: { fontFamily: fonts.body, fontSize: 16, borderWidth: 1, borderRadius: 10, padding: 13, textAlign: 'right' },
  key: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, textAlign: 'left', writingDirection: 'ltr', flexShrink: 1 },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
});
