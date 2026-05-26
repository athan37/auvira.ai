/**
 * Local integration test: introduction-section image placement + preview HTML.
 * Usage: npx tsx scripts/test-introduction-image-local.ts [workspacePath]
 *
 * If workspacePath is omitted, uses a temp workspace built from the builder page template.
 */

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import { PAGE_TSX_TEMPLATE } from '../src/lib/builder/pageTemplate';
import { SITE_CONFIG_TYPE_BLOCK } from '../src/lib/builder/siteConfigTypes';
import { analyzeSiteStructureForImages, planImagePlacementFallback } from '../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { applyImagePlacementToSiteConfig } from '../src/lib/project-workspace/website-edit-agent/applyImagePlacementPlan';
import {
  applyUniversalImageRenderer,
  canRenderUploadedImages,
  stampPageForGalleryPreviewReload,
} from '../src/lib/project-workspace/website-edit-agent/universalImageRenderer';
import { validateGalleryInSiteConfigSource } from '../src/lib/project-workspace/website-edit-agent/validateGallerySiteConfig';
import { startWorkspaceDevServer } from '../src/lib/preview/startWorkspaceDevServer';
import { repairPreviewWorkspace } from '../src/lib/preview/repairPreviewWorkspace';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const PROMPT = 'add this image to the introduction section';

function makePng(): Buffer {
  const out = path.join(os.tmpdir(), `intro-test-${Date.now()}.png`);
  execSync(
    `python3 -c "import struct,zlib; w,h=32,32; raw=b''.join(b'\\x00'+bytes((80,120,200))*w for _ in range(h)); open('${out}','wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+b''.join([struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff) for t,d in [(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0)),(b'IDAT',zlib.compress(raw)),(b'IEND',b'')]]))"`,
    { stdio: 'ignore' }
  );
  return readFileSync(out);
}

function scaffoldWorkspace(root: string): void {
  const preset = JSON.stringify({
    pageBg: 'bg-white',
    heroBg: 'bg-slate-900',
    heroText: 'text-white',
    heroMutedText: 'text-slate-300',
    heroEyebrow: 'text-slate-400',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-slate-50',
    sectionEyebrow: 'text-indigo-600',
    sectionTitle: 'text-slate-950',
    sectionBody: 'text-slate-600',
    card: 'border-slate-200 bg-white',
    navBg: 'bg-white',
    navBorder: 'border-slate-200',
    navText: 'text-slate-900',
    primaryButton: 'bg-indigo-600 text-white',
    secondaryButton: 'border-white text-white',
    iconBadge: 'bg-indigo-600',
    footerBg: 'bg-slate-900',
    heroOverlay: 'bg-black/40',
  });

  const siteConfig = `${SITE_CONFIG_TYPE_BLOCK}
export const siteConfig: SiteConfig = {
  "businessName": "Intro Test Co",
  "tagline": "We help you get started",
  "hero": {
    "headline": "Welcome",
    "subheadline": "Quality service",
    "primaryCta": "Call us",
    "secondaryCta": "Learn more"
  },
  "sections": [
    {
      "type": "about",
      "title": "Introduction",
      "body": "We are a local team focused on great outcomes.",
      "items": []
    },
    {
      "type": "services",
      "title": "Our Services",
      "body": "What we offer.",
      "items": [{ "title": "Service A", "description": "Fast and reliable." }]
    }
  ]
};
`;

  const page = PAGE_TSX_TEMPLATE.replace('__PRESET_JSON__', preset);

  mkdirSync(path.join(root, 'src/lib'), { recursive: true });
  mkdirSync(path.join(root, 'src/app'), { recursive: true });
  mkdirSync(path.join(root, 'public/uploads'), { recursive: true });

  writeFileSync(path.join(root, 'src/lib/siteConfig.ts'), siteConfig, 'utf8');
  writeFileSync(path.join(root, 'src/app/page.tsx'), page, 'utf8');
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'intro-image-test',
        private: true,
        scripts: { dev: 'next dev' },
        dependencies: { next: '14.2.35', react: '18.2.0', 'react-dom': '18.2.0' },
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'es2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: false,
          noEmit: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          jsx: 'preserve',
          paths: { '@/*': ['./src/*'] },
        },
        include: ['src'],
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'next.config.js'),
    "module.exports = { reactStrictMode: true };",
    'utf8'
  );
}

async function main() {
  const argPath = process.argv[2];
  const tempRoot = argPath || mkdtempSync(path.join(os.tmpdir(), 'intro-img-test-'));
  const cleanup = !argPath;

  if (!argPath) {
    console.log('Scaffolding temp workspace:', tempRoot);
    scaffoldWorkspace(tempRoot);
  }

  const siteConfigPath = path.join(tempRoot, 'src/lib/siteConfig.ts');
  const pagePath = path.join(tempRoot, 'src/app/page.tsx');
  const siteBefore = readFileSync(siteConfigPath, 'utf8');
  const pageBefore = readFileSync(pagePath, 'utf8');

  const uploadDir = path.join(tempRoot, 'public/uploads');
  mkdirSync(uploadDir, { recursive: true });
  const png = makePng();
  const filename = 'intro-photo.png';
  writeFileSync(path.join(uploadDir, filename), png);

  const attachments: WorkspaceAssetAttachment[] = [
    {
      id: 'intro1',
      path: `public/uploads/${filename}`,
      publicUrl: `/uploads/${filename}`,
      previewUrl: `/uploads/${filename}`,
      originalName: filename,
      mimeType: 'image/png',
      size: png.length,
    },
  ];

  const snapshot = analyzeSiteStructureForImages(siteBefore, pageBefore);
  const plan = planImagePlacementFallback(snapshot, PROMPT);
  console.log('Plan:', JSON.stringify(plan, null, 2));

  const siteAfter = applyImagePlacementToSiteConfig(
    siteBefore,
    plan,
    attachments,
    snapshot,
    PROMPT
  );
  const renderPatch = applyUniversalImageRenderer(pageBefore, snapshot.rendersFromSiteConfig ? 'section_loop' : undefined);
  let pageAfter = renderPatch.patched ? renderPatch.content : pageBefore;
  pageAfter = stampPageForGalleryPreviewReload(pageAfter);

  const configCheck = validateGalleryInSiteConfigSource(siteAfter, attachments);
  if (!configCheck.ok) {
    console.error('FAIL config:', configCheck.reason);
    process.exit(1);
  }

  if (!siteAfter.includes('"title": "Introduction"') || !siteAfter.includes('/uploads/intro-photo.png')) {
    console.error('FAIL: Introduction section missing imageUrl in siteConfig');
    process.exit(1);
  }

  if (!canRenderUploadedImages(pageAfter)) {
    console.error('FAIL: page cannot render gallery images');
    process.exit(1);
  }

  writeFileSync(siteConfigPath, siteAfter, 'utf8');
  writeFileSync(pagePath, pageAfter, 'utf8');
  console.log('Wrote siteConfig + page.tsx (stamped)');

  if (!argPath) {
    console.log('Installing deps (first run may take a minute)...');
    execSync('npm install --prefer-offline --no-audit --no-fund', {
      cwd: tempRoot,
      stdio: 'inherit',
    });
  }

  await repairPreviewWorkspace(tempRoot);
  const port = 3055;
  console.log('Starting preview on port', port);
  await startWorkspaceDevServer(tempRoot, port, { timeoutMs: 180_000 });
  await new Promise((r) => setTimeout(r, 3000));

  const res = await fetch(`http://127.0.0.1:${port}/?t=${Date.now()}`, { cache: 'no-store' });
  const html = await res.text();
  const hasImage =
    html.includes('/uploads/intro-photo.png') || html.includes('intro-photo.png');
  const hasIntro = /Introduction/i.test(html);

  console.log({
    http: res.status,
    htmlLength: html.length,
    hasImageInHtml: hasImage,
    hasIntroductionTitle: hasIntro,
  });

  if (cleanup) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }

  if (!hasImage) {
    console.error('\nFAIL: preview HTML does not contain uploaded image path');
    process.exit(1);
  }

  console.log('\nPASS: introduction image visible in local preview HTML');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
