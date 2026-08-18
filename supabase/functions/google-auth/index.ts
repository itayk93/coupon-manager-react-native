import { corsHeaders, corsHeadersFor } from '../_shared/cors.ts';
import { adminClient, issueSessionToken } from '../_shared/session.ts';
import { safeFetch } from '../_shared/ssrf.ts';

const supabaseAdmin = adminClient();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(request) });

  try {
    const { access_token } = await request.json();
    if (!access_token || typeof access_token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing Google access token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const googleResponse = await safeFetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!googleResponse.ok) throw new Error('Google token validation failed');

    const profile = await googleResponse.json();
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email || profile.email_verified !== true) throw new Error('Google account email is not verified');

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id,email,first_name,last_name,is_admin,is_confirmed,is_deleted,auth_user_id')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.is_deleted) throw new Error('The user is blocked');

    let user = existing;
    const firstName = String(profile.given_name || profile.name || email.split('@')[0]).slice(0, 150);
    const lastName = String(profile.family_name || '').slice(0, 150);

    if (!user) {
      const { data: created, error: createError } = await supabaseAdmin
        .from('users')
        .insert({ email, password: null, first_name: firstName, last_name: lastName, is_confirmed: true, google_id: String(profile.sub || '') })
        .select('id,email,first_name,last_name,is_admin,is_confirmed,is_deleted,auth_user_id')
        .single();
      if (createError) throw createError;
      user = created;
    } else {
      const { data: refreshed, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ is_confirmed: true, google_id: String(profile.sub || '') })
        .eq('id', user.id)
        .select('id,email,first_name,last_name,is_admin,is_confirmed,is_deleted,auth_user_id')
        .single();
      if (updateError) throw updateError;
      user = refreshed;
    }

    // Without this the caller ends up with a legacy user object and no
    // Supabase session, which means auth.uid() is null and RLS hides all of
    // their own data from them.
    const tokenHash = await issueSessionToken(supabaseAdmin, user.id, user.email, user.auth_user_id);

    return new Response(JSON.stringify({
      token_hash: tokenHash,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: Boolean(user.is_admin),
        is_confirmed: Boolean(user.is_confirmed),
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Google authentication failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
