/**
 * Test: section + attached product image (same as owner chat flow).
 * Usage: SITE_AGENT_DEV_BYPASS_AUTH=1 npx tsx --env-file=.env scripts/test-section-with-image.ts [projectId] [imagePath]
 */

import { readFileSync } from 'fs';
import path from 'path';
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
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const IMAGE_PATH =
  process.argv[3] ||
  path.join(
    process.cwd(),
    '.cursor/projects/Users-anhthan-Documents-Claude-Dev-google-rapid-agent/assets/image-afbd1ce7-f7ad-4482-8210-3565becdd30f.png'
  );
const PROMPT =
  "this is our special product for this home, let's make a section for it";
const DEV_USER = '507f1f77bcf86cd799439011';

async function main() {
  if (process.env.SITE_AGENT_DEV_BYPASS_AUTH !== '1') {
    console.error('Set SITE_AGENT_DEV_BYPASS_AUTH=1');
    process.exit(1);
  }

  const buffer = readFileSync(IMAGE_PATH);
  await connectMongoDB();
  const project = await WebsiteProject.findById(PROJECT_ID);
  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  console.log('=== Section + image test ===');
  console.log('Project:', PROJECT_ID);
  console.log('Image:', IMAGE_PATH, `(${buffer.length} bytes)`);
  console.log('Prompt:', PROMPT);

  await bootstrapProjectPreview(project, DEV_USER);
  const updated = await WebsiteProject.findById(PROJECT_ID);
  const port = updated?.preview?.port;
  if (!port) {
    console.error('No preview port');
    process.exit(1);
  }

  const attachments: WorkspaceAssetAttachment[] = await saveWorkspaceImages({
    workspacePath,
    mode: 'gitlab',
    projectId: PROJECT_ID,
    files: [{ name: 'special-product.png', mimeType: 'image/png', buffer }],
  });
  console.log('Uploaded:', attachments[0]?.publicUrl);

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
    ownerMessage: result.ownerMessage?.slice(0, 200),
  });

  if (result.ok) {
    await repairPreviewWorkspace(workspacePath);
    await new Promise((r) => setTimeout(r, 2500));
    const healthy = await checkPreviewHealthy(port, 12_000);
    const res = await fetch(`http://127.0.0.1:${port}/?t=${Date.now()}`, { cache: 'no-store' });
    const html = await res.text();
    const uploadPath = attachments[0]?.publicUrl?.replace(/^\//, '') ?? '';
    const hasImage = uploadPath ? html.includes(uploadPath) : false;
    const hasProduct =
      /special product|our special|product for this home/i.test(html) ||
      html.includes('generic') ||
      /id="product"|ProductSection/i.test(html);

    console.log('\n--- Preview ---');
    console.log({
      healthy,
      http: res.status,
      hasUploadInHtml: hasImage,
      uploadPath,
      hasProductCopy: hasProduct,
    });

    if (!healthy || !hasImage) {
      console.log('\nFAIL: preview missing image or unhealthy');
      process.exit(1);
    }
    console.log('\nPASS: section edit with image visible in preview');
    process.exit(0);
  }

  console.log('\nFAIL:', result.error ?? 'agent returned ok=false');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
