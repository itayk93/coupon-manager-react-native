import {supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from '@/integrations/supabase/client';
import {AI_CONSENT_KEY, aiConsentRecord, hasAiConsent} from './aiConsentRecord';
import {aiConsentSaved} from './aiConsentDialog';

const changed = () => new Error('החשבון השתנה. יש לפתוח מחדש ולאשר עבור החשבון הנוכחי');
/** Bind the write to the account that saw the disclosure, even during sign-out/sign-in. */
export async function saveAiConsent(granted: boolean, expectedOwnerId: string) {
  const {data: sessionData, error: sessionError} = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session || session.user.id !== expectedOwnerId) throw changed();
  const token = session.access_token;
  const {data, error} = await supabase.auth.getUser(token);
  if (error || data.user?.id !== expectedOwnerId) throw changed();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== expectedOwnerId || current.data.session.access_token !== token) throw changed();
  // A shared auth client's updateUser can acquire a NEW account's token after an
  // await. This request deliberately uses only the verified, captured token.
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${token}`},
    body: JSON.stringify({data:{[AI_CONSENT_KEY]:aiConsentRecord(granted)}}),
  });
  if (!response.ok) throw new Error('הבחירה לא נשמרה. אפשר לנסות שוב בלי לשלוח מידע ל-AI');
  const verified = await supabase.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== expectedOwnerId || hasAiConsent(verified.data.user) !== granted) {
    throw new Error('לא ניתן לאמת שהבחירה נשמרה. מידע לא יישלח ל-AI');
  }
  aiConsentSaved();
  const active = await supabase.auth.getSession();
  if (active.error || active.data.session?.user.id !== expectedOwnerId) throw changed();
}
