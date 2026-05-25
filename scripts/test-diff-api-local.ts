/**
 * Local test for GET /api/projects/:id/code-agent/diff
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/test-diff-api-local.ts
 *   node --env-file=.env --import tsx scripts/test-diff-api-local.ts <projectId> <jobId>
 */

import { connectMongoDB } from '../src/lib/mongodb';
import { getLatestEditJob } from '../src/lib/project-workspace/editJobLogger';
import { WebsiteProject } from '../src/models/WebsiteProject';

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const JOB_ID = process.argv[3] || '6a13e305e47706cf035c18f1';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

function log(label: string, detail?: unknown) {
  console.log(detail !== undefined ? `[diff-local] ${label}: ${JSON.stringify(detail, null, 2)}` : `[diff-local] ${label}`);
}

async function testMongoLookup() {
  await connectMongoDB();
  const project = await WebsiteProject.findById(PROJECT_ID).lean();
  if (!project) {
    throw new Error(`Project ${PROJECT_ID} not found in MongoDB`);
  }
  log('project', { name: project.name, ownerId: String(project.ownerId) });

  const job = await getLatestEditJob(PROJECT_ID, JOB_ID);
  if (!job) {
    log('mongo job', 'NOT FOUND (getLatestEditJob returned null)');
    return null;
  }
  log('mongo job', {
    jobId: job._id.toString(),
    status: job.status,
    changedFiles: job.changedFiles?.length ?? 0,
    error: job.error?.slice(0, 200) ?? null,
    logCount: job.logs?.length ?? 0,
    promptPreview: job.prompt?.slice(0, 80),
    logs: job.logs?.map((l) => ({ type: l.type, message: l.message })),
  });
  return { project, job };
}

async function testRouteHandlerDirect(ownerId: string) {
  // Same logic as diff/route.ts after getOwnerProject succeeds
  const project = await WebsiteProject.findOne({
    _id: PROJECT_ID,
    ownerId,
  });
  if (!project) {
    throw new Error('Owner project lookup failed');
  }

  const job = await getLatestEditJob(PROJECT_ID, JOB_ID);
  const body = job
    ? {
        ok: true,
        jobId: job._id.toString(),
        status: job.status,
        changedFiles: job.changedFiles ?? [],
        error: job.error ?? null,
      }
    : {
        ok: true,
        jobId: null,
        error: 'Edit job not found for this project.',
      };

  log('route logic (owner verified)', body);
  return body;
}

async function testHttpUnauthenticated() {
  const url = `${BASE}/api/projects/${PROJECT_ID}/code-agent/diff?jobId=${JOB_ID}`;
  log('HTTP GET (no cookie)', url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    log('HTTP status', res.status);
    log('HTTP body preview', text.slice(0, 300));
    if (res.status !== 401 && res.status !== 404) {
      console.warn('[diff-local] Expected 401 without session; got', res.status);
    }
  } catch (err) {
    log('HTTP failed', err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('[diff-local] MONGODB_URI not set. Run with: node --env-file=.env --import tsx scripts/test-diff-api-local.ts');
    process.exit(1);
  }

  log('start', { PROJECT_ID, JOB_ID, BASE });

  const found = await testMongoLookup();
  if (found) {
    await testRouteHandlerDirect(String(found.project.ownerId));
  }

  await testHttpUnauthenticated();

  console.log('\n[diff-local] Done. Sign in at http://localhost:3000 and open the project Changes tab to verify in the UI.');
}

main().catch((err) => {
  console.error('[diff-local] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
