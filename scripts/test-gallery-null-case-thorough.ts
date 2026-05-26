/**
 * Thorough regression: gallery switch `return null` + verify + first-section placement.
 * Usage: SITE_AGENT_DEV_BYPASS_AUTH=1 npx tsx --env-file=.env scripts/test-gallery-null-case-thorough.ts [projectId]
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { connectMongoDB } from '../src/lib/mongodb';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { saveWorkspaceImages } from '../src/lib/project-workspace/workspaceAssets';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { resolveSiteWorkspace } from '../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
import {
  applyUniversalImageRenderer,
  pageHasGalleryRenderer,
  patchSectionRendererDisabledCases,
  sectionRendererRoutesGallery,
} from '../src/lib/project-workspace/website-edit-agent/universalImageRenderer';
import { resolveEditPreviewVerification } from '../src/lib/project-workspace/verifyPreviewForPrompt';
import { verifyGalleryEditOnSandbox } from '../src/lib/project-workspace/verifySandboxGalleryPreview';
import { startWorkspaceDevServer } from '../src/lib/preview/startWorkspaceDevServer';
import { checkPreviewHealthy } from '../src/lib/project-workspace/bootstrapProjectPreview';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const PROJECT_ID = process.argv[2] || '6a14f7316310ebb2c0d88513';
const PROMPT = 'add these images to the first section';

const ASSET_DIR =
  '/Users/anhthan/.cursor/projects/Users-anhthan-Documents-Claude-Dev-google-rapid-agent/assets';

const DEFAULT_IMAGES = [
  `${ASSET_DIR}/3.19-4431179f-0198-4f08-a916-52bd3b9e96e1.png`,
  `${ASSET_DIR}/3.28-c7f3a891-3756-46df-9812-15623aa6c623.png`,
  `${ASSET_DIR}/3.18-f026ffae-5434-4b6f-bf4e-6c1935c36c51.png`,
  `${ASSET_DIR}/nezuko_no_bamboo-452760ca-6bd7-4c7f-a58f-95b92f71a9f4.png`,
];

let failures = 0;

function assert(cond: boolean, label: string): void {
  if (!cond) {
    console.error('FAIL:', label);
    failures += 1;
  } else {
    console.log('OK:', label);
  }
}

async function main() {
  if (process.env.SITE_AGENT_DEV_BYPASS_AUTH !== '1') {
    console.error('Set SITE_AGENT_DEV_BYPASS_AUTH=1');
    process.exit(1);
  }

  const imagePaths = process.argv.slice(3).length > 0 ? process.argv.slice(3) : DEFAULT_IMAGES;
  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  const pagePath = path.join(workspacePath, 'src/app/page.tsx');

  console.log('=== Gallery null-case thorough test ===\n');

  // --- Unit-style checks on workspace page ---
  const pageLive = readFileSync(pagePath, 'utf8');
  assert(sectionRendererRoutesGallery(pageLive), 'workspace page routes gallery (not return null)');
  assert(pageHasGalleryRenderer(pageLive), 'workspace pageHasGalleryRenderer');

  const brokenSample = `
function GallerySection({ section }: { section: SiteSection }) {
  return section.items?.filter((item) => (item as { imageUrl?: string }).imageUrl).map((item, i) => (
    <img key={i} src={(item as { imageUrl: string }).imageUrl} alt="" />
  ));
}
function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case "gallery": return null;
    default: return null;
  }
}`;
  assert(!sectionRendererRoutesGallery(brokenSample), 'broken sample has disabled gallery case');
  const fixed = patchSectionRendererDisabledCases(brokenSample);
  assert(fixed.patched, 'patchSectionRendererDisabledCases patches broken sample');
  assert(sectionRendererRoutesGallery(fixed.content), 'patched sample routes gallery');

  const simulated = applyUniversalImageRenderer(brokenSample, 'section_loop');
  assert(pageHasGalleryRenderer(simulated.content), 'applyUniversalImageRenderer fixes broken sample');

  // --- Verify: null case should fail pre-render check ---
  const nullPage = brokenSample;
  const fakeAttachments: WorkspaceAssetAttachment[] = [
    {
      id: 't1',
      path: 'public/uploads/t.png',
      publicUrl: '/uploads/t.png',
      previewUrl: '/uploads/t.png',
      originalName: 't.png',
      mimeType: 'image/png',
      size: 1,
    },
  ];
  const siteConfigStub = `export const siteConfig = { sections: [{ type: "gallery", title: "G", items: [{ imageUrl: "/uploads/t.png" }] }] };`;
  const verifyNull = await verifyGalleryEditOnSandbox({
    previewUrl: 'http://127.0.0.1:9',
    siteConfigSource: siteConfigStub,
    pageSource: nullPage,
    attachments: fakeAttachments,
  });
  assert(!verifyNull.ok, 'verifyGalleryEditOnSandbox fails when page cannot render gallery');
  assert(
    verifyNull.imagesFound === 0 &&
      (verifyNull.reason.includes('cannot render gallery') ||
        verifyNull.reason.includes('page.tsx')),
    `verify pre-check failed as expected: ${verifyNull.reason}`
  );

  await connectMongoDB();
  const project = await WebsiteProject.findById(PROJECT_ID);
  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  const files = imagePaths.map((imagePath, i) => {
    const buffer = readFileSync(imagePath);
    return {
      name: path.basename(imagePath) || `img-${i + 1}.png`,
      mimeType: 'image/png',
      buffer,
    };
  });

  console.log('\n--- Live agent:', PROMPT, `(${files.length} images) ---`);
  const attachments = await saveWorkspaceImages({
    workspacePath,
    mode: 'gitlab',
    projectId: PROJECT_ID,
    files,
  });

  const beforePage = readFileSync(pagePath, 'utf8');
  const result = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage: PROMPT,
    projectId: PROJECT_ID,
    mode: 'gitlab',
    attachments,
  });

  assert(result.ok === true, `agent ok (strategy=${result.strategy}, err=${result.error ?? 'none'})`);
  assert(result.strategy === 'image_gallery', 'agent used image_gallery strategy');

  const afterPage = readFileSync(pagePath, 'utf8');
  assert(sectionRendererRoutesGallery(afterPage), 'post-edit page routes gallery');
  assert(pageHasGalleryRenderer(afterPage), 'post-edit pageHasGalleryRenderer');

  const snap = await resolveSiteWorkspace({ workspacePath, mode: 'gitlab' });
  assert(Boolean(snap.siteConfigContent), 'siteConfig readable after edit');
  for (const att of attachments) {
    assert(
      (snap.siteConfigContent ?? '').includes(att.publicUrl),
      `siteConfig contains ${att.publicUrl}`
    );
  }

  const previewPort = 3050 + Math.floor(Math.random() * 40);
  console.log('\n--- Fresh preview on port', previewPort, '---');
  await startWorkspaceDevServer(workspacePath, previewPort, { timeoutMs: 120_000 });
  await new Promise((r) => setTimeout(r, 2500));
  const healthy = await checkPreviewHealthy(previewPort, 20_000);
  assert(healthy, 'preview dev server healthy');

  const previewUrl = `http://127.0.0.1:${previewPort}`;
  const htmlRes = await fetch(`${previewUrl}/?t=${Date.now()}`, { cache: 'no-store' });
  const html = await htmlRes.text();
  assert(htmlRes.ok, 'preview HTTP 200');
  assert(html.length > 15_000, `preview HTML substantial (${html.length} bytes)`);

  let inHtml = 0;
  for (const att of attachments) {
    const rel = att.publicUrl.replace(/^\//, '');
    const hit = html.includes(rel) || html.includes(att.publicUrl);
    if (hit) inHtml += 1;
    assert(hit, `preview HTML contains ${att.publicUrl}`);
  }
  assert(inHtml === attachments.length, `all ${attachments.length} images in preview HTML`);

  const galleryVerify = await verifyGalleryEditOnSandbox({
    previewUrl,
    siteConfigSource: snap.siteConfigContent ?? '',
    pageSource: afterPage,
    attachments,
  });
  assert(galleryVerify.ok, `verifyGalleryEditOnSandbox: ${galleryVerify.reason}`);
  assert(
    galleryVerify.imagesFound >= attachments.length,
    `gallery verify found ${galleryVerify.imagesFound}/${attachments.length} images`
  );

  const resolveVerify = await resolveEditPreviewVerification({
    previewUrl,
    projectId: PROJECT_ID,
    ownerMessage: PROMPT,
    attachments,
    isSandbox: false,
    mode: 'gitlab',
    workspaceSnap: snap,
  });
  assert(resolveVerify.ok, `resolveEditPreviewVerification (local): ${resolveVerify.reason}`);
  assert(
    resolveVerify.imagesFound >= attachments.length,
    `resolve verify images ${resolveVerify.imagesFound}/${attachments.length}`
  );

  // Restore page if agent didn't need to change renderer (idempotent check)
  if (beforePage === afterPage) {
    console.log('(page.tsx unchanged by agent — renderer already fixed)');
  }

  console.log('\n=== Summary ===');
  if (failures > 0) {
    console.error(`${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`All checks passed (${files.length} images, first-section prompt)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
