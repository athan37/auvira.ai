/**
 * Test: section + multiple uploaded images (owner documentation flow).
 * Usage: SITE_AGENT_DEV_BYPASS_AUTH=1 npx tsx --env-file=.env scripts/test-multi-image-section.ts [projectId]
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { patchPageForUploadedImages } from '../src/lib/project-workspace/website-edit-agent/patchGenericSectionImages';
import { connectMongoDB } from '../src/lib/mongodb';
import { WebsiteProject } from '../src/models/WebsiteProject';
import {
  bootstrapProjectPreview,
  checkPreviewHealthy,
} from '../src/lib/project-workspace/bootstrapProjectPreview';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { saveWorkspaceImages } from '../src/lib/project-workspace/workspaceAssets';
import { repairPreviewWorkspace } from '../src/lib/preview/repairPreviewWorkspace';
import { startWorkspaceDevServer } from '../src/lib/preview/startWorkspaceDevServer';
import { checkPreviewHealthy } from '../src/lib/project-workspace/bootstrapProjectPreview';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const PROMPT =
  "these are great documentations of all the product, let's make a section for it";
const DEV_USER = '507f1f77bcf86cd799439011';

const DEFAULT_IMAGES = [
  '/Users/anhthan/.cursor/projects/Users-anhthan-Documents-Claude-Dev-google-rapid-agent/assets/3.19-4431179f-0198-4f08-a916-52bd3b9e96e1.png',
  '/Users/anhthan/.cursor/projects/Users-anhthan-Documents-Claude-Dev-google-rapid-agent/assets/3.28-c7f3a891-3756-46df-9812-15623aa6c623.png',
  '/Users/anhthan/.cursor/projects/Users-anhthan-Documents-Claude-Dev-google-rapid-agent/assets/3.18-f026ffae-5434-4b6f-bf4e-6c1935c36c51.png',
];

async function main() {
  if (process.env.SITE_AGENT_DEV_BYPASS_AUTH !== '1') {
    console.error('Set SITE_AGENT_DEV_BYPASS_AUTH=1');
    process.exit(1);
  }

  const imagePaths = process.argv.slice(3).length > 0 ? process.argv.slice(3) : DEFAULT_IMAGES;

  await connectMongoDB();
  const project = await WebsiteProject.findById(PROJECT_ID);
  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  console.log('=== Multi-image section test ===');
  console.log('Project:', PROJECT_ID);
  console.log('Images:', imagePaths.length);
  console.log('Prompt:', PROMPT);

  const files = imagePaths.map((imagePath, i) => {
    const buffer = readFileSync(imagePath);
    const base = path.basename(imagePath);
    console.log(`  - ${base} (${buffer.length} bytes)`);
    return {
      name: base || `doc-${i + 1}.png`,
      mimeType: 'image/png',
      buffer,
    };
  });

  await bootstrapProjectPreview(project, DEV_USER);
  const updated = await WebsiteProject.findById(PROJECT_ID);
  let port = updated?.preview?.port;
  if (!port) {
    console.error('No preview port');
    process.exit(1);
  }
  // Port 3000 is often the main Site Agent app, not the workspace Next dev server.
  const probe = await fetch(`http://127.0.0.1:${port}/?t=${Date.now()}`, { cache: 'no-store' }).catch(
    () => null
  );
  const probeHtml = probe ? await probe.text() : '';
  const businessHint =
    (updated?.businessProfile?.businessName as string | undefined) || 'Houston';
  const looksLikeWorkspace =
    probeHtml.includes(businessHint.slice(0, 12)) ||
    probeHtml.includes('Houston') ||
    probeHtml.includes('HVAC');
  if (!looksLikeWorkspace && port === 3000) {
    for (const tryPort of [3001, 3002, 3003, 3004, 3005, 3010, 3020, 3030]) {
      const r = await fetch(`http://127.0.0.1:${tryPort}/`, { cache: 'no-store' }).catch(() => null);
      if (!r?.ok) continue;
      const h = await r.text();
      if (h.includes('Houston') || h.includes('HVAC')) {
        port = tryPort;
        console.log('Detected workspace preview on port', port);
        break;
      }
    }
  }
  console.log('Preview port:', port, looksLikeWorkspace ? '(workspace)' : '(verify manually)');

  const attachments: WorkspaceAssetAttachment[] = await saveWorkspaceImages({
    workspacePath,
    mode: 'gitlab',
    projectId: PROJECT_ID,
    files,
  });
  console.log(
    'Uploaded:',
    attachments.map((a) => a.publicUrl).join(', ')
  );

  const t0 = Date.now();
  const result = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage: PROMPT,
    projectId: PROJECT_ID,
    mode: 'gitlab',
    attachments,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n--- Agent ---');
  console.log({
    ok: result.ok,
    strategy: result.strategy,
    elapsedSec: elapsed,
    error: result.error,
    changedFiles: result.changedFiles,
    ownerMessage: result.ownerMessage?.slice(0, 300),
  });

  if (!result.ok) {
    console.log('\nFAIL:', result.error ?? 'agent returned ok=false');
    process.exit(1);
  }

  const pagePath = path.join(workspacePath, 'src/app/page.tsx');
  const pageBefore = readFileSync(pagePath, 'utf8');
  const { content: pagePatched, patched } = patchPageForUploadedImages(pageBefore);
  if (patched) {
    writeFileSync(pagePath, pagePatched, 'utf8');
    console.log('Patched page.tsx for imageUrl in DocumentationSection');
  }

  await repairPreviewWorkspace(workspacePath);

  const previewPort = 3015 + Math.floor(Math.random() * 50);
  console.log('Starting workspace next dev on port', previewPort);
  await startWorkspaceDevServer(workspacePath, previewPort, { timeoutMs: 120_000 });

  await new Promise((r) => setTimeout(r, 2000));
  const healthy = await checkPreviewHealthy(previewPort, 15_000);
  const res = await fetch(`http://127.0.0.1:${previewPort}/?t=${Date.now()}`, { cache: 'no-store' });
  const html = await res.text();

  const uploadHits = attachments.map((a) => {
    const rel = a.publicUrl.replace(/^\//, '');
    return { url: a.publicUrl, inHtml: html.includes(rel) || html.includes(a.publicUrl) };
  });
  const hasDocSection =
    /documentation|product documentation|documentations/i.test(html) ||
    /type:\s*["']generic["']/.test(html);

  console.log('\n--- Preview ---');
  console.log({
    healthy,
    http: res.status,
    uploadHits,
    hasDocSection,
    htmlLength: html.length,
  });

  const imagesInPreview = uploadHits.filter((h) => h.inHtml).length;
  if (!healthy || imagesInPreview < attachments.length) {
    console.log(
      `\nFAIL: preview unhealthy or only ${imagesInPreview}/${attachments.length} images in HTML`
    );
    process.exit(1);
  }

  console.log(`\nPASS: ${imagesInPreview} images visible in preview after section edit`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
