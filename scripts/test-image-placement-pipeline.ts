/**
 * End-to-end test: structure analysis → placement plan (fallback) → apply → page patch → preview HTML.
 * Usage: npx tsx scripts/test-image-placement-pipeline.ts [workspacePath]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { analyzeSiteStructureForImages, planImagePlacementFallback } from '../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { applyImagePlacementToSiteConfig } from '../src/lib/project-workspace/website-edit-agent/applyImagePlacementPlan';
import {
  pageCanRenderGallerySection,
  patchPageForUploadedImages,
} from '../src/lib/project-workspace/website-edit-agent/patchGenericSectionImages';
import { planImagePlacement } from '../src/lib/project-workspace/website-edit-agent/imagePlacementPlan';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';
import { startWorkspaceDevServer } from '../src/lib/preview/startWorkspaceDevServer';
import { repairPreviewWorkspace } from '../src/lib/preview/repairPreviewWorkspace';

const workspacePath =
  process.argv[2] ||
  path.join(process.cwd(), '.tmp/git-workspaces/6a135ba264e7672599597ea1/repo');

const siteConfigPath = path.join(workspacePath, 'src/lib/siteConfig.ts');
const pagePath = path.join(workspacePath, 'src/app/page.tsx');

function makePng(): Buffer {
  const { execSync } = require('child_process') as typeof import('child_process');
  const out = '/tmp/pipeline-test.png';
  execSync(
    `python3 -c "import struct,zlib; w,h=40,40; raw=b''.join(b'\\x00'+bytes((200,50,50))*w for _ in range(h)); open('${out}','wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+b''.join([struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff) for t,d in [(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0)),(b'IDAT',zlib.compress(raw)),(b'IEND',b'')]]))"`,
    { stdio: 'ignore' }
  );
  return readFileSync(out);
}

async function main() {
  console.log('=== Image placement pipeline test ===');
  console.log('Workspace:', workspacePath);

  const siteBefore = readFileSync(siteConfigPath, 'utf8');
  const pageBefore = readFileSync(pagePath, 'utf8');
  const snapshot = analyzeSiteStructureForImages(siteBefore, pageBefore);
  console.log('\n--- Structure ---');
  console.log('Sections:', snapshot.sections.length);
  console.log('Types in page:', snapshot.sectionTypesInPage.join(', '));
  console.log('Default null:', snapshot.defaultRendersNull);

  const uploadDir = path.join(workspacePath, 'public/uploads');
  mkdirSync(uploadDir, { recursive: true });
  const png = makePng();
  const names = ['pipeline-a.png', 'pipeline-b.png'];
  const attachments: WorkspaceAssetAttachment[] = names.map((name, i) => {
    writeFileSync(path.join(uploadDir, name), png);
    return {
      id: `p${i}`,
      path: `public/uploads/${name}`,
      publicUrl: `/uploads/${name}`,
      previewUrl: `/uploads/${name}`,
      originalName: name,
      mimeType: 'image/png',
      size: png.length,
    };
  });

  const message = "these are really important images of our product, let's make a section for it";

  let plan;
  let usedLlm = false;
  try {
    const planned = await planImagePlacement({
      ownerMessage: message,
      attachments,
      siteConfigContent: siteBefore,
      pageContent: pageBefore,
    });
    plan = planned.plan;
    usedLlm = planned.usedLlm;
  } catch {
    plan = planImagePlacementFallback(snapshot, message);
  }
  if (!plan) {
    plan = planImagePlacementFallback(snapshot, message);
  }

  console.log('\n--- Plan ---', usedLlm ? '(LLM)' : '(fallback)');
  console.log(JSON.stringify(plan, null, 2));

  const siteAfter = applyImagePlacementToSiteConfig(siteBefore, plan, attachments, snapshot);
  const { content: pageAfter, patched } = patchPageForUploadedImages(pageBefore);
  const canRender = pageCanRenderGallerySection(patched ? pageAfter : pageBefore);

  writeFileSync(siteConfigPath, siteAfter, 'utf8');
  if (patched) writeFileSync(pagePath, pageAfter, 'utf8');

  const urlsOk = attachments.every((a) => siteAfter.includes(a.publicUrl));
  const orderOk =
    plan.insertAfterSectionType && plan.action === 'create_section'
      ? (() => {
          const anchor = siteAfter.indexOf(`"type": "${plan.insertAfterSectionType}"`);
          const gallery = siteAfter.indexOf('"type": "gallery"');
          return anchor >= 0 && gallery > anchor;
        })()
      : true;

  console.log('\n--- Apply ---');
  console.log({ urlsInConfig: urlsOk, pagePatched: patched, canRender, orderOk });

  if (!urlsOk || !canRender) {
    console.error('\nFAIL: config or page render check');
    process.exit(1);
  }

  await repairPreviewWorkspace(workspacePath);
  const port = 3040 + Math.floor(Math.random() * 40);
  console.log('\n--- Preview on port', port, '---');
  await startWorkspaceDevServer(workspacePath, port, { timeoutMs: 120_000 });
  await new Promise((r) => setTimeout(r, 2000));

  const res = await fetch(`http://127.0.0.1:${port}/?t=${Date.now()}`, { cache: 'no-store' });
  const html = await res.text();
  const hits = attachments.filter((a) => html.includes(a.publicUrl)).length;
  const hasGallerySection = /id="gallery"|Gallery<\/p>|Our products|Our work/i.test(html);

  console.log({ http: res.status, htmlLength: html.length, imageHits: hits, hasGallerySection });

  if (hits < attachments.length) {
    console.error(`\nFAIL: only ${hits}/${attachments.length} images in preview HTML`);
    process.exit(1);
  }

  console.log('\nPASS: placement pipeline OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
