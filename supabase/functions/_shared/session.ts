// Mints a real Supabase session for a legacy user row.
//
// Both entry points (password login and Google) need this, and they must agree:
// if either one hands back a user without a session, that user is invisible to
// RLS and loses access to their own data.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Ensures an auth.users row exists for this legacy user, links it back to
 * public.users.auth_user_id, and returns a one-time token the client exchanges
 * for a session via verifyOtp.
 *
 * The auth password is a server-generated random value nobody ever sees. The
 * caller is responsible for having authenticated the user already — by the
 * Werkzeug hash, or by a verified Google token.
 */
export async function issueSessionToken(
  supabaseAdmin: SupabaseClient,
  userId: number,
  email: string,
  authUserId: string | null,
): Promise<string> {
  let authId = authUserId;

  if (!authId) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { legacy_user_id: userId },
    });

    if (createError) {
      // A concurrent login, or the other entry point, may have created it.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw createError;
      authId = existing.id;
    } else {
      authId = created.user.id;
    }
  }

  const { error: linkError } = await supabaseAdmin
    .from('users')
    .update({ auth_user_id: authId })
    .eq('id', userId);
  if (linkError) throw linkError;

  const { data: link, error: linkGenError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkGenError) throw linkGenError;

  return link.properties.hashed_token;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
