import {useEffect, useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {hasAiConsent} from './aiConsentRecord';
export {hasAiConsent, aiConsentRecord, AI_CONSENT_KEY} from './aiConsentRecord';
export const AI_PERMISSION_MESSAGE = 'לפני שיתוף מידע עם OpenAI נדרש אישור מפורש. אפשר לאשר בחשבון > שיתוף עם AI, או להמשיך בהזנה ידנית ללא AI.';
/** Check the current canonical account, not the legacy profile or a request-body flag. */
export async function requireAiConsent() {
  const {data, error} = await supabase.auth.getUser();
  if (error || !hasAiConsent(data.user)) throw new Error(AI_PERMISSION_MESSAGE);
  return data.user!;
}
export function useAiConsent() {
  const [state, setState] = useState<{userId: string | null; allowed: boolean; loading: boolean}>({userId:null, allowed:false, loading:true});
  useEffect(() => {
    let alive = true;
    let changed = false;
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (alive) setState({userId:session?.user.id || null, allowed:hasAiConsent(session?.user), loading:false});
    });
    void supabase.auth.getUser().then(({data,error}) => {
      if (alive && !changed) setState({userId:data.user?.id || null, allowed:!error && hasAiConsent(data.user), loading:false});
    }).catch(() => {if(alive && !changed)setState({userId:null,allowed:false,loading:false})});
    return () => {alive=false; listener.subscription.unsubscribe()};
  }, []);
  return state;
}
