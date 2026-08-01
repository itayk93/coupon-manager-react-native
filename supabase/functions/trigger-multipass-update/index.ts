import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type DispatchResult =
  | { success: true; runId: string | null; runUrl: string | null; workflow: string; ref: string }
  | { success: false; error: string };

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function dispatchMultipassWorkflow(couponCodes: string[]): Promise<DispatchResult> {
  const githubToken = Deno.env.get('GITHUB_TOKEN');
  if (!githubToken) return { success: false, error: 'GITHUB_TOKEN not configured' };

  const repoOwner = Deno.env.get('MULTIPASS_GH_OWNER') || 'itayk93';
  const repoName = Deno.env.get('MULTIPASS_GH_REPO') || 'scrape_multipass';
  const workflowId = Deno.env.get('MULTIPASS_GH_WORKFLOW') || 'scrape.yml';
  const workflowRef = Deno.env.get('MULTIPASS_GH_REF') || 'main';
  const inputKey = Deno.env.get('MULTIPASS_GH_INPUT_KEY') || 'card_number';
  const inputSeparator = Deno.env.get('MULTIPASS_GH_INPUT_SEPARATOR') || ',';

  const safeCodes = couponCodes.map((code) => code.trim()).filter(Boolean);
  if (!safeCodes.length) return { success: false, error: 'No coupon codes provided' };

  const headers = {
    authorization: `Bearer ${githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json',
  };

  const triggerUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/dispatches`;
  const dispatchResponse = await fetch(triggerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: workflowRef,
      inputs: {
        [inputKey]: safeCodes.join(inputSeparator),
      },
    }),
  });

  if (!dispatchResponse.ok) {
    return {
      success: false,
      error: `GitHub workflow dispatch failed: ${dispatchResponse.status} ${await dispatchResponse.text()}`,
    };
  }

  let runId: string | null = null;
  let runUrl: string | null = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const runsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/runs?event=workflow_dispatch&per_page=1`;
    const runsResponse = await fetch(runsUrl, { headers });
    if (runsResponse.ok) {
      const runsPayload = await runsResponse.json();
      const latestRun = runsPayload?.workflow_runs?.[0];
      runId = latestRun?.id ? String(latestRun.id) : null;
      runUrl = latestRun?.html_url ?? null;
    }
  } catch {
    // Best effort only.
  }

  return { success: true, runId, runUrl, workflow: workflowId, ref: workflowRef };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = Number(body.user_id);
    const couponId = body.coupon_id ? Number(body.coupon_id) : null;

    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonResponse({ error: 'user_id חסר או לא תקין' }, 400);
    }

    const supabase = supa();
    let query = supabase
      .from('coupon')
      .select('id, code')
      .eq('user_id', userId)
      .eq('auto_update', true)
      .eq('auto_download_details', 'Multipass')
      .neq('status', 'נוצל');

    if (couponId) query = query.eq('id', couponId);

    const { data: coupons, error } = await query;
    if (error) throw error;

    const couponCodes = (coupons || []).map((coupon) => coupon.code).filter(Boolean);
    if (!couponCodes.length) {
      return jsonResponse({ success: true, dispatched: false, message: 'No active Multipass coupons found' });
    }

    const dispatchResult = await dispatchMultipassWorkflow(couponCodes);
    if (!dispatchResult.success) {
      return jsonResponse({ success: false, error: dispatchResult.error }, 502);
    }

    return jsonResponse({
      success: true,
      dispatched: true,
      count: couponCodes.length,
      run_id: dispatchResult.runId,
      run_url: dispatchResult.runUrl,
      workflow: dispatchResult.workflow,
      ref: dispatchResult.ref,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
