import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Paid OpenAI calls per user per rolling 24h, shared by every AI function. */
export const MAX_AI_CALLS_PER_DAY = 60;

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/**
 * Counts the caller's gpt_usage rows from the last 24h.
 * Fails open: if the usage table cannot be read the call still runs, because
 * losing the feature entirely is worse than allowing an occasional extra call.
 */
export async function isOverDailyLimit(userId: number): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await serviceClient()
      .from('gpt_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created', since);

    if (error) return false;
    return (count ?? 0) >= MAX_AI_CALLS_PER_DAY;
  } catch {
    return false;
  }
}

/** Records one paid call. Logging must never break the feature. */
export async function recordAiUsage(userId: number, model: string, usage?: {
  prompt_tokens?: number; completion_tokens?: number; total_tokens?: number;
}): Promise<void> {
  try {
    await serviceClient().from('gpt_usage').insert({
      user_id: userId,
      created: new Date().toISOString(),
      model,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
    });
  } catch { /* ignore */ }
}
