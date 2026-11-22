import {useEffect, useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {askAiConsent, AiConsentCancelled, onAiConsentSaved} from './aiConsentDialog';
import {hasAiConsent} from './aiConsentRecord';
export {AiConsentCancelled} from './aiConsentDialog';
export {hasAiConsent, aiConsentRecord, AI_CONSENT_KEY} from './aiConsentRecord';
export const AI_PERMISSION_MESSAGE = 'לפני שיתוף מידע עם OpenAI נדרש אישור מפורש. אפשר לאשר בחשבון > שיתוף עם AI, או להמשיך בהזנה ידנית ללא AI.';
/** Check the current canonical account, not a cached session or a request-body flag. */
export async function requireAiConsent() {
  const {data, error} = await supabase.auth.getUser();
  if (error || !hasAiConsent(data.user)) throw new Error(AI_PERMISSION_MESSAGE);
  return data.user!;
}
/** Interactive only for a parse action, never for background merchant queries. */
export async function requestAiConsent() {
  const {data, error} = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('נדרשת התחברות לפני השימוש ב-AI');
  const ownerId = data.user.id;
  if (!hasAiConsent(data.user) && !(await askAiConsent(ownerId))) throw new AiConsentCancelled();
  const verified = await requireAiConsent();
  if (verified.id !== ownerId) throw new Error('החשבון השתנה. יש לנסות שוב עבור החשבון הנוכחי');
  return verified;
}
/** Pin the in-flight parse to the account that explicitly consented. */
export async function invokeAiForOwner(name: string, body: Record<string, unknown>, ownerId: string) {
  const {data, error} = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session || session.user.id !== ownerId) throw new Error('החשבון השתנה. יש לנסות שוב');
  const canonical = await supabase.auth.getUser(session.access_token);
  if (canonical.error || canonical.data.user?.id !== ownerId || !hasAiConsent(canonical.data.user)) throw new Error(AI_PERMISSION_MESSAGE);
  const fresh = await supabase.auth.getSession();
  if (fresh.error || fresh.data.session?.user.id !== ownerId || fresh.data.session.access_token !== session.access_token) throw new Error('החשבון השתנה. יש לנסות שוב');
  const result = await supabase.functions.invoke(name, {body, headers:{Authorization:`Bearer ${session.access_token}`}});
  const active = await supabase.auth.getSession();
  if (active.error || active.data.session?.user.id !== ownerId) throw new Error('החשבון השתנה. התוצאה לא תוצג בחשבון אחר');
  return result;
}
export function useAiConsent() {
  const [state, setState] = useState<{userId: string | null; allowed: boolean; loading: boolean}>({userId:null, allowed:false, loading:true});
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const refresh = () => {
      const revision = ++generation;
      setState(s => ({...s, allowed:false, loading:true}));
      void supabase.auth.getUser().then(({data,error}) => {
        if (alive && revision === generation) setState({userId:data.user?.id || null,allowed:!error && hasAiConsent(data.user),loading:false});
      }).catch(() => {if(alive && revision === generation)setState({userId:null,allowed:false,loading:false});});
    };
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session) { ++generation; setState({userId:null,allowed:false,loading:false}); }
      else refresh();
    });
    const stopRefresh = onAiConsentSaved(refresh);
    refresh();
    return () => {alive=false; ++generation; stopRefresh(); listener.subscription.unsubscribe();};
  }, []);
  return state;
}
