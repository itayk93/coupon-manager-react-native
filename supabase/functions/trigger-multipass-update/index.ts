import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireSameUser, requireUser } from '../_shared/auth.ts';
import { decryptCouponCodes } from '../_shared/encryption.ts';
import { safeFetch } from '../_shared/ssrf.ts';

type DispatchResult =
  | { success: true; provider: 'github' | 'gitlab'; runId: string | null; runUrl: string | null; workflow: string; ref: string }
  | { success: false; error: string };

type CiProvider = 'github' | 'gitlab';

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function dispatchGitHubWorkflow(couponCodes: string[]): Promise<DispatchResult> {
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
  const dispatchResponse = await safeFetch(triggerUrl, {
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
    const runsResponse = await safeFetch(runsUrl, { headers });
    if (runsResponse.ok) {
      const runsPayload = await runsResponse.json();
      const latestRun = runsPayload?.workflow_runs?.[0];
      runId = latestRun?.id ? String(latestRun.id) : null;
      runUrl = latestRun?.html_url ?? null;
    }
  } catch {
    // Best effort only.
  }

  return { success: true, provider: 'github', runId, runUrl, workflow: workflowId, ref: workflowRef };
}

async function dispatchGitLabPipeline(couponCodes: string[]): Promise<DispatchResult> {
  const triggerToken = Deno.env.get('MULTIPASS_GITLAB_TRIGGER_TOKEN');
  const projectId = Deno.env.get('MULTIPASS_GITLAB_PROJECT_ID');
  const pipelineRef = Deno.env.get('MULTIPASS_GITLAB_REF') || 'main';

  if (!triggerToken) return { success: false, error: 'MULTIPASS_GITLAB_TRIGGER_TOKEN not configured' };
  if (!projectId) return { success: false, error: 'MULTIPASS_GITLAB_PROJECT_ID not configured' };

  const safeCodes = couponCodes.map((code) => code.trim()).filter(Boolean);
  if (!safeCodes.length) return { success: false, error: 'No coupon codes provided' };

  const body = new URLSearchParams({
    token: triggerToken,
    ref: pipelineRef,
    'variables[CARD_NUMBER]': safeCodes.join(','),
  });
  const triggerUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/trigger/pipeline`;
  const response = await safeFetch(triggerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    return {
      success: false,
      error: `GitLab pipeline trigger failed: ${response.status} ${await response.text()}`,
    };
  }

  const payload = await response.json();
  return {
    success: true,
    provider: 'gitlab',
    runId: payload?.id ? String(payload.id) : null,
    runUrl: payload?.web_url ?? null,
    workflow: 'scrape_multipass',
    ref: pipelineRef,
  };
}

function scheduledProvider(): CiProvider {
  const mode = Deno.env.get('MULTIPASS_CI_MODE')?.trim().toLowerCase() || 'github';
  if (mode === 'gitlab') return 'gitlab';
  if (mode === 'alternate') return new Date().getUTCHours() % 2 === 0 ? 'github' : 'gitlab';
  return 'github';
}

function dispatchMultipassWorkflow(couponCodes: string[], provider: CiProvider): Promise<DispatchResult> {
  return provider === 'gitlab'
    ? dispatchGitLabPipeline(couponCodes)
    : dispatchGitHubWorkflow(couponCodes);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = Number(body.user_id);
    const couponId = body.coupon_id ? Number(body.coupon_id) : null;

    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonResponse({ error: 'user_id חסר או לא תקין' }, 400);
    }
    const authenticatedUser = await requireUser(req);
    requireSameUser(userId, authenticatedUser.id);

    const supabase = supa();
    let query = supabase
      .from('coupon')
      .select('id, code, last_scraped, last_detail_view, last_company_view, last_code_view')
      .eq('user_id', userId)
      .eq('auto_update', true)
      .eq('auto_download_details', 'Multipass')
      .neq('status', 'נוצל');

    if (couponId) query = query.eq('id', couponId);

    const { data: coupons, error } = await query;
    if (error) throw error;

    const eligibleCoupons = (coupons || []).filter((coupon) => {
      if (!coupon.last_scraped) return true;
      const views = [coupon.last_detail_view, coupon.last_company_view, coupon.last_code_view]
        .filter(Boolean)
        .map((value) => Date.parse(value));
      return views.length > 0 && Math.max(...views) > Date.parse(coupon.last_scraped);
    });
    const encryptedCodes = eligibleCoupons.map((coupon) => coupon.code).filter(Boolean);
    const couponCodes = await decryptCouponCodes(encryptedCodes);
    if (!couponCodes.length) {
      return jsonResponse({ success: true, dispatched: false, message: 'No active Multipass coupons found' });
    }

    const requestedProvider = body.provider === 'github' || body.provider === 'gitlab'
      ? body.provider
      : scheduledProvider();
    const dispatchResult = await dispatchMultipassWorkflow(couponCodes, requestedProvider);
    if (!dispatchResult.success) {
      return jsonResponse({ success: false, error: dispatchResult.error }, 502);
    }

    return jsonResponse({
      success: true,
      dispatched: true,
      count: couponCodes.length,
      provider: dispatchResult.provider,
      run_id: dispatchResult.runId,
      run_url: dispatchResult.runUrl,
      workflow: dispatchResult.workflow,
      ref: dispatchResult.ref,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
