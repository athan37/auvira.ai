/**
 * Static workspace gallery patch smoke test.
 * Usage: npx tsx scripts/test-static-image-gallery.ts [workspacePath]
 */

import { readFileSync } from 'fs';
import path from 'path';
import { runStaticImageGalleryStrategy } from '../src/lib/project-workspace/website-edit-agent/staticImageGalleryStrategy';
import { validateStaticGalleryFiles } from '../src/lib/project-workspace/website-edit-agent/staticImageGalleryStrategy';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const workspacePath =
  process.argv[2] || path.join(process.cwd(), 'tests/fixtures/workspaces/static-html');

const attachments: WorkspaceAssetAttachment[] = [
  {
    id: 's1',
    path: 'public/uploads/static-a.png',
    publicUrl: '/uploads/static-a.png',
    previewUrl: '/uploads/static-a.png',
    originalName: 'static-a.png',
    mimeType: 'image/png',
    size: 1,
  },
];

async function main() {
  console.log('=== Static image gallery test ===');
  console.log('Workspace:', workspacePath);

  const beforeHashes = {
    'index.html': 'before',
    'site.json': 'before',
  };

  const result = await runStaticImageGalleryStrategy(
    {
      workspacePath,
      ownerMessage: 'add product photos to the site',
      projectId: 'script-test',
      mode: 'static',
      attachments,
    },
    beforeHashes
  );

  if (!result?.ok) {
    console.error('FAIL:', result?.error || 'no result');
    process.exit(1);
  }

  const indexHtml = readFileSync(path.join(workspacePath, 'index.html'), 'utf8');
  const siteJson = readFileSync(path.join(workspacePath, 'site.json'), 'utf8');
  const check = validateStaticGalleryFiles(indexHtml, siteJson, attachments);

  console.log({ strategy: result.strategy, changedFiles: result.changedFiles, check });
  if (!check.ok) {
    console.error('FAIL:', check.reason);
    process.exit(1);
  }

  console.log('PASS: static gallery pipeline OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
