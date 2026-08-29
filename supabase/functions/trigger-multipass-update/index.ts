import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, jsonResponse } from '../_shared/cors.ts';
import { requireSameUser, requireUser } from '../_shared/auth.ts';
import { decryptCouponCodes } from '../_shared/encryption.ts';
import { safeFetch } from '../_shared/ssrf.ts';

type DispatchResult =
  | { success: true; provider: 'github' | 'circleci'; runId: string | null; runUrl: string | null; workflow: string; ref: string }
  | { success: false; error: string };

type RunLog = {
  userId: number;
  status: string;
  jobId?: string | null;
  failedCount?: number;
  skippedCount?: number;
  message: Record<string, unknown>;
};

function supa() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function isCronRequest(req: Request): boolean {
  const presented = req.headers.get('x-cron-token') || '';
  const expected = Deno.env.get('MULTIPASS_CRON_TOKEN') || '';
  if (!presented || !expected || presented.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < presented.length; i += 1) {
    mismatch |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

async function dispatchGitHubWorkflow(
  couponCodes: string[],
  fallbackFromCircle = false,
  circleciRunId: string | null = null,
): Promise<DispatchResult> {
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
        fallback_from_circle: fallbackFromCircle ? 'true' : 'false',
        circleci_run_id: circleciRunId || '',
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

async function dispatchCircleCIPipeline(couponCodes: string[]): Promise<DispatchResult> {
  const apiToken = Deno.env.get('CIRCLECI_API_TOKEN');
  const projectSlug = Deno.env.get('CIRCLECI_PROJECT_SLUG') || 'gh/itayk93/scrape_multipass';
  const pipelineRef = Deno.env.get('MULTIPASS_CIRCLECI_REF') || 'main';

  if (!apiToken) return { success: false, error: 'CIRCLECI_API_TOKEN not configured' };

  const safeCodes = couponCodes.map((code) => code.trim()).filter(Boolean);
  if (!safeCodes.length) return { success: false, error: 'No coupon codes provided' };

  const encodedSlug = projectSlug.split('/').map(encodeURIComponent).join('/');
  const triggerUrl = `https://circleci.com/api/v2/project/${encodedSlug}/pipeline`;
  const response = await safeFetch(triggerUrl, {
    method: 'POST',
    headers: {
      'Circle-Token': apiToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      branch: pipelineRef,
      parameters: {
        run_scrape: true,
        card_number: safeCodes.join(','),
      },
    }),
  });

  if (!response.ok) {
    return {
      success: false,
      error: `CircleCI pipeline trigger failed: ${response.status} ${await response.text()}`,
    };
  }

  const payload = await response.json();
  const pipelineNumber = payload?.number ? String(payload.number) : null;
  const webVcs = projectSlug.startsWith('gh/') ? 'github' : projectSlug.split('/')[0];
  const webProject = projectSlug.split('/').slice(1).join('/');
  return {
    success: true,
    provider: 'circleci',
    runId: payload?.id ? String(payload.id) : null,
    runUrl: pipelineNumber
      ? `https://app.circleci.com/pipelines/${webVcs}/${webProject}/${pipelineNumber}`
      : null,
    workflow: 'scrape_multipass',
    ref: pipelineRef,
  };
}

function compactError(error: string): string {
  return error.replace(/\s+/g, ' ').trim().slice(0, 1500);
}

async function recordRun(log: RunLog): Promise<string | null> {
  const { error } = await supa().from('auto_update_runs').insert({
    user_id: log.userId,
    triggered_by_user_id: log.userId,
    run_type: 'multipass_ci',
    status: log.status,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    updated_count: 0,
    failed_count: log.failedCount || 0,
    skipped_count: log.skippedCount || 0,
    job_id: log.jobId || null,
    message: JSON.stringify(log.message),
  });
  return error ? compactError(error.message) : null;
}

function jerusalemHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = Number(body.user_id);
    const couponId = body.coupon_id ? Number(body.coupon_id) : null;
    const action = String(body.action || 'dispatch');
    const cronRequest = isCronRequest(req);

    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonResponse({ error: 'user_id חסר או לא תקין' }, 400);
    }
    if (!cronRequest) {
      const authenticatedUser = await requireUser(req);
      requireSameUser(userId, authenticatedUser);
    }
    if (action === 'github_failure') {
      if (!cronRequest) return jsonResponse({ error: 'UNAUTHENTICATED' }, 401);
      const githubRunId = String(body.github_run_id || '').trim() || null;
      const loggingError = await recordRun({
        userId,
        status: 'failed',
        jobId: githubRunId,
        failedCount: 2,
        message: {
          event: 'multipass_ci_double_failure',
          primary: 'circleci',
          fallback: 'github',
          circleci_run_id: String(body.circleci_run_id || '').trim() || null,
          github_run_id: githubRunId,
          error: compactError(String(body.error || 'GitHub Actions fallback failed')),
        },
      });
      return jsonResponse({ success: true, recorded: true, status: 'failed', logging_error: loggingError });
    }

    if (cronRequest && action === 'dispatch') {
      const hour = jerusalemHour();
      if (hour < 8 || hour > 23) {
        return jsonResponse({ success: true, dispatched: false, message: 'Outside scheduled hours', hour });
      }
    }

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
      if (action === 'circleci_failure') {
        const loggingError = await recordRun({
          userId,
          status: 'circleci_failed_no_pending_coupons',
          jobId: String(body.circleci_run_id || '').trim() || null,
          failedCount: 1,
          message: {
            event: 'circleci_failure',
            fallback_dispatched: false,
            reason: 'No coupons remained eligible after the CircleCI run',
          },
        });
        return jsonResponse({ success: true, dispatched: false, recorded: true, logging_error: loggingError });
      }
      return jsonResponse({ success: true, dispatched: false, message: 'No active Multipass coupons found' });
    }

    if (action === 'circleci_failure') {
      if (!cronRequest) return jsonResponse({ error: 'UNAUTHENTICATED' }, 401);
      const circleciError = compactError(String(body.error || 'CircleCI job failed'));
      const circleciRunId = String(body.circleci_run_id || '').trim() || null;
      const fallbackResult = await dispatchGitHubWorkflow(couponCodes, true, circleciRunId);
      if (!fallbackResult.success) {
        const githubError = compactError(fallbackResult.error);
        const loggingError = await recordRun({
          userId,
          status: 'failed',
          jobId: circleciRunId,
          failedCount: 2,
          message: {
            event: 'multipass_ci_double_failure',
            primary: 'circleci',
            fallback: 'github',
            coupon_count: couponCodes.length,
            circleci_error: circleciError,
            github_error: githubError,
          },
        });
        return jsonResponse({ success: false, error: githubError, fallback: 'github', logging_error: loggingError }, 502);
      }

      const loggingError = await recordRun({
        userId,
        status: 'fallback_dispatched',
        jobId: fallbackResult.runId,
        failedCount: 1,
        message: {
          event: 'circleci_failure',
          primary: 'circleci',
          fallback: 'github',
          coupon_count: couponCodes.length,
          circleci_run_id: circleciRunId,
          circleci_error: circleciError,
          github_run_id: fallbackResult.runId,
          github_run_url: fallbackResult.runUrl,
        },
      });
      return jsonResponse({
        success: true,
        dispatched: true,
        fallback: true,
        provider: fallbackResult.provider,
        count: couponCodes.length,
        run_id: fallbackResult.runId,
        run_url: fallbackResult.runUrl,
        logging_error: loggingError,
      });
    }

    const circleResult = await dispatchCircleCIPipeline(couponCodes);
    if (!circleResult.success) {
      const circleciError = compactError(circleResult.error);
      const fallbackResult = await dispatchGitHubWorkflow(couponCodes, true, 'dispatch_failed');
      if (!fallbackResult.success) {
        const githubError = compactError(fallbackResult.error);
        const loggingError = await recordRun({
          userId,
          status: 'failed',
          failedCount: 2,
          message: {
            event: 'multipass_ci_double_failure',
            primary: 'circleci',
            fallback: 'github',
            coupon_count: couponCodes.length,
            circleci_error: circleciError,
            github_error: githubError,
          },
        });
        return jsonResponse({ success: false, error: githubError, primary_error: circleciError, logging_error: loggingError }, 502);
      }

      const loggingError = await recordRun({
        userId,
        status: 'fallback_dispatched',
        jobId: fallbackResult.runId,
        failedCount: 1,
        message: {
          event: 'circleci_dispatch_failure',
          primary: 'circleci',
          fallback: 'github',
          coupon_count: couponCodes.length,
          circleci_error: circleciError,
          github_run_id: fallbackResult.runId,
          github_run_url: fallbackResult.runUrl,
        },
      });
      return jsonResponse({
        success: true,
        dispatched: true,
        fallback: true,
        count: couponCodes.length,
        provider: fallbackResult.provider,
        run_id: fallbackResult.runId,
        run_url: fallbackResult.runUrl,
        logging_error: loggingError,
      });
    }

    const loggingError = await recordRun({
      userId,
      status: 'circleci_dispatched',
      jobId: circleResult.runId,
      message: {
        event: 'circleci_dispatch',
        provider: 'circleci',
        coupon_count: couponCodes.length,
        run_id: circleResult.runId,
        run_url: circleResult.runUrl,
      },
    });
    return jsonResponse({
      success: true,
      dispatched: true,
      count: couponCodes.length,
      provider: circleResult.provider,
      run_id: circleResult.runId,
      run_url: circleResult.runUrl,
      workflow: circleResult.workflow,
      ref: circleResult.ref,
      logging_error: loggingError,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
