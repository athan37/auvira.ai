/**
 * Test clone preview workspace rehydration (simulates missing disk on Vercel).
 *
 * Usage:
 *   node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/test-clone-rehydrate-local.ts [jobId]', {stdio:'inherit'})"
 */

import { promises as fs } from 'fs';
import { connectMongoDB } from '../src/lib/mongodb';
import { CloneJob } from '../src/lib/db/models/CloneJob';
import { ensureClonePreviewWorkspace } from '../src/lib/clone/ensureClonePreviewWorkspace';
import { readWorkspaceFiles } from '../src/lib/clone/persistClonePreview';
import { scratchPath } from '../src/lib/runtime/scratchDir';

const JOB_ID = process.argv[2] || '6a13e39fb3e260f7e3a13ea5';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('[rehydrate-local] MONGODB_URI required');
    process.exit(1);
  }

  await connectMongoDB();
  const job = await CloneJob.findById(JOB_ID);
  if (!job) {
    console.error(`[rehydrate-local] Job ${JOB_ID} not found`);
    process.exit(1);
  }

  console.log('[rehydrate-local] job', {
    id: job._id.toString(),
    status: job.status,
    hasPreviewSpec: Boolean(job.previewSiteSpec),
    workspacePath: job.technicalBuild?.workspacePath,
  });

  const wp = scratchPath('generated-sites', job._id.toString());
  await fs.rm(wp, { recursive: true, force: true }).catch(() => {});
  console.log('[rehydrate-local] deleted disk workspace:', wp);

  const restored = await ensureClonePreviewWorkspace(job);
  const files = readWorkspaceFiles(restored);

  console.log('[rehydrate-local] PASSED', {
    path: restored,
    fileCount: files.length,
    sample: files.slice(0, 3).map((f) => f.filePath),
  });
}

main().catch((err) => {
  console.error('[rehydrate-local] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
