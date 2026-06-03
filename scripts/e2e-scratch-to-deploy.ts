/**
 * Live E2E: scratch build → GitLab → Vercel → production verify.
 *
 * Usage:
 *   SITE_AGENT_DEV_BYPASS_AUTH=1 npm run dev   # in another terminal
 *   npm run test:scratch-live-e2e
 *   npm run test:scratch-live-e2e -- --http http://localhost:3000
 *   npm run test:scratch-live-e2e -- --with-llm-propose   # full propose + build (slower)
 *
 * Requires in .env: MONGODB_URI, GITLAB_TOKEN, GITLAB_GROUP_ID, Vercel tokens.
 * Dev server must run with SITE_AGENT_DEV_BYPASS_AUTH=1 (or pass E2E_SESSION_COOKIE).
 */

import {
  scratchE2eExpectedHeadline,
  scratchE2eIntake,
  scratchE2ePlanAfterSelections,
} from '../tests/support/scratchE2eFixture';

const args = process.argv.slice(2);
const httpBase = args.includes('--http')
  ? args[args.indexOf('--http') + 1] || 'http://localhost:3000'
  : process.env.E2E_BASE_URL || 'http://localhost:3000';
const withLlmPropose = args.includes('--with-llm-propose');
const skipDeployPoll = args.includes('--skip-deploy-poll');
const sessionCookie = process.env.E2E_SESSION_COOKIE?.trim();

function log(step: string, detail?: string) {
  console.log(detail ? `[scratch-e2e] ${step}: ${detail}` : `[scratch-e2e] ${step}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  return headers;
}

async function postJson<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const url = `${httpBase.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response (${res.status}) from ${path}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, data };
}

async function getJson<T>(path: string): Promise<{ status: number; data: T }> {
  const url = `${httpBase.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.Cookie = sessionCookie;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response (${res.status}) from ${path}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, data };
}

interface ProposeResponse {
  ok: boolean;
  error?: string;
  websitePlan?: unknown;
  layoutStarterId?: string;
}

interface BuildResponse {
  ok: boolean;
  error?: string;
  projectId?: string;
  deploymentFailed?: boolean;
  warning?: string;
  stage?: string;
  deployment?: {
    status?: string;
    expectedProductionUrl?: string | null;
    vercelProjectName?: string;
  };
}

interface DeploymentStatusResponse {
  ok: boolean;
  status?: string;
  liveUrl?: string | null;
  expectedProductionUrl?: string | null;
  commitVerified?: boolean;
  contentVerified?: boolean;
  message?: string;
  error?: string;
}

async function proposePlan(): Promise<{ websitePlan: unknown; layoutStarterId?: string }> {
  log('1/4', 'Proposing website plan (live LLM)…');
  const { status, data } = await postJson<ProposeResponse>('/api/projects/scratch/propose', {
    ...scratchE2eIntake,
    layoutStarterId: 'phone-first-service',
    templateCategory: 'home-services',
    templateVariant: 'local-service-pro',
  });

  if (status === 401) {
    throw new Error(
      'Unauthorized — start dev with SITE_AGENT_DEV_BYPASS_AUTH=1 or set E2E_SESSION_COOKIE'
    );
  }
  if (!data.ok || !data.websitePlan) {
    throw new Error(data.error || `Propose failed (${status})`);
  }
  return { websitePlan: data.websitePlan, layoutStarterId: data.layoutStarterId };
}

async function buildProject(websitePlan: unknown): Promise<BuildResponse> {
  log('2/4', 'Building website (generate + GitLab + Vercel trigger)…');
  const { status, data } = await postJson<BuildResponse>('/api/projects/scratch/build', {
    websitePlan,
    projectName: scratchE2eIntake.businessName,
    layoutStarterId: 'phone-first-service',
    intake: scratchE2eIntake,
    validateBuild: true,
  });

  if (status === 401) {
    throw new Error(
      'Unauthorized — start dev with SITE_AGENT_DEV_BYPASS_AUTH=1 or set E2E_SESSION_COOKIE'
    );
  }
  if (!data.ok || !data.projectId) {
    throw new Error(
      data.error || `Build failed (${status}) stage=${data.stage ?? 'unknown'}`
    );
  }

  if (data.deploymentFailed) {
    log('warn', data.warning || 'Vercel trigger failed — will still poll deployment-status');
  }

  return data;
}

async function pollDeployment(
  projectId: string,
  expectedProductionUrl?: string | null
): Promise<{ liveUrl: string; via: 'api' | 'http-fallback' }> {
  log('3/4', `Polling deployment for project ${projectId}…`);
  const maxAttempts = 60;
  let last: DeploymentStatusResponse | null = null;
  const productionUrl = expectedProductionUrl?.replace(/\/$/, '') || null;

  for (let i = 1; i <= maxAttempts; i++) {
    if (productionUrl) {
      try {
        const res = await fetch(productionUrl, { headers: { 'Cache-Control': 'no-cache' } });
        if (res.status === 200) {
          const html = await res.text();
          if (html.includes(scratchE2eExpectedHeadline)) {
            console.log('');
            log('poll', `Production URL live (HTTP fallback): ${productionUrl}`);
            return { liveUrl: productionUrl, via: 'http-fallback' };
          }
        }
      } catch {
        // keep polling API + HTTP
      }
    }

    const { status, data } = await getJson<DeploymentStatusResponse>(
      `/api/projects/${projectId}/deployment-status`
    );

    if (status === 400 && data.error?.includes('No Vercel project')) {
      throw new Error(data.error);
    }
    if (status !== 200 || !data.ok) {
      throw new Error(data.error || data.message || `deployment-status failed (${status})`);
    }

    last = data;
    const label = `${data.status} commitVerified=${data.commitVerified} contentVerified=${data.contentVerified}`;
    process.stdout.write(`   [${i}/${maxAttempts}] ${label}\r`);

    if (data.status === 'ready' && data.commitVerified) {
      console.log('');
      const liveUrl =
        data.liveUrl || data.expectedProductionUrl || productionUrl;
      if (!liveUrl) {
        throw new Error('Deployment ready but no live URL returned');
      }
      return { liveUrl, via: 'api' };
    }
    if (data.status === 'failed') {
      console.log('');
      throw new Error(`Deployment failed: ${data.message}`);
    }

    await sleep(5000);
  }

  console.log('');
  throw new Error(
    `Timed out waiting for deployment. Last: ${last?.status} — ${last?.message ?? 'unknown'}`
  );
}

async function verifyProduction(url: string): Promise<void> {
  log('4/4', `Fetching production URL: ${url}`);
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();

  if (res.status !== 200) {
    throw new Error(`Production HTTP ${res.status} for ${url}`);
  }
  if (!html.includes(scratchE2eExpectedHeadline)) {
    throw new Error(
      `Production page missing expected headline "${scratchE2eExpectedHeadline}"`
    );
  }
  log('verify', `Production includes headline "${scratchE2eExpectedHeadline}"`);
}

async function main() {
  console.log('=== Scratch E2E: new site → deployment ===');
  console.log('Base URL:', httpBase);
  console.log('Propose mode:', withLlmPropose ? 'live LLM' : 'fixture plan (no LLM)');
  console.log('Auth:', sessionCookie ? 'E2E_SESSION_COOKIE' : 'dev bypass (expected on server)');
  console.log('');

  let websitePlan: unknown;
  if (withLlmPropose) {
    const proposed = await proposePlan();
    websitePlan = proposed.websitePlan;
  } else {
    log('1/4', 'Using fixture website plan (skip LLM propose)');
    websitePlan = scratchE2ePlanAfterSelections();
  }

  const build = await buildProject(websitePlan);
  log('build', `projectId=${build.projectId} stage=${build.stage}`);
  log('editor', `${httpBase.replace(/\/$/, '')}/projects/${build.projectId}`);

  if (skipDeployPoll) {
    console.log('\n[scratch-e2e] Skipped deploy poll (--skip-deploy-poll). Build OK.');
    return;
  }

  const deployment = await pollDeployment(
    build.projectId!,
    build.deployment?.expectedProductionUrl
  );
  await verifyProduction(deployment.liveUrl);

  console.log('\n=== E2E PASSED ===');
  console.log('Project:', build.projectId);
  console.log('Live URL:', deployment.liveUrl);
  console.log('Verified via:', deployment.via);
}

main().catch((err) => {
  console.error('\n[scratch-e2e] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
