/**
 * Local smoke test: broken siteConfig (gallery section, legacy type union) → repair → tsc.
 *
 * Usage:
 *   npx tsx scripts/test-siteconfig-gallery-repair-local.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { repairSiteConfigTypesInWorkspace } from '../src/lib/preview/repairSiteConfigTypes';
import {
  siteConfigNeedsGalleryTypeUpgrade,
  ensureSiteConfigTypesSupportGallery,
} from '../src/lib/builder/siteConfigTypes';

const BROKEN_SITE_CONFIG = `export type SiteSection = {
  type: 'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic';
  title: string;
  items?: Array<{ title: string; description?: string }>;
};

export type SiteConfig = {
  businessName: string;
  hero: { headline: string };
  contact: { phone?: string; email?: string };
  sections: SiteSection[];
};

export const siteConfig: SiteConfig = {
  businessName: 'Varsity Zone HVAC',
  hero: { headline: 'Expert HVAC' },
  contact: {},
  sections: [
    {
      type: 'gallery',
      title: 'Our Products',
      body: 'Professional HVAC services in Houston',
      items: [{ title: 'Unit A', imageUrl: '/uploads/a.png' }],
    },
  ],
};
`;

const PAGE_TSX = `import { siteConfig } from '@/lib/siteConfig';

export default function Home() {
  return (
    <main>
      <h1>{siteConfig.hero.headline}</h1>
      {siteConfig.sections.map((s, i) => (
        <section key={i}><h2>{s.title}</h2></section>
      ))}
    </main>
  );
}
`;

const LAYOUT = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`;

const PACKAGE_JSON = {
  name: 'gallery-repair-smoke',
  private: true,
  scripts: { build: 'next build' },
  dependencies: {
    next: '14.2.35',
    react: '18.2.0',
    'react-dom': '18.2.0',
  },
  devDependencies: {
    typescript: '5.4.5',
    '@types/node': '20.0.0',
    '@types/react': '18.2.0',
    '@types/react-dom': '18.2.0',
  },
};

const TSCONFIG = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    incremental: true,
    paths: { '@/*': ['./src/*'] },
  },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
  exclude: ['node_modules'],
};

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`;

function log(msg: string, detail?: unknown) {
  console.log(detail !== undefined ? `[gallery-repair] ${msg}: ${JSON.stringify(detail)}` : `[gallery-repair] ${msg}`);
}

async function writeWorkspace(root: string, siteConfigContent: string) {
  await fs.mkdir(path.join(root, 'src/app'), { recursive: true });
  await fs.mkdir(path.join(root, 'src/lib'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(PACKAGE_JSON, null, 2));
  await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify(TSCONFIG, null, 2));
  await fs.writeFile(path.join(root, 'next.config.js'), NEXT_CONFIG);
  await fs.writeFile(path.join(root, 'next-env.d.ts'), '/// <reference types="next" />\n');
  await fs.writeFile(path.join(root, 'src/lib/siteConfig.ts'), siteConfigContent);
  await fs.writeFile(path.join(root, 'src/app/page.tsx'), PAGE_TSX);
  await fs.writeFile(path.join(root, 'src/app/layout.tsx'), LAYOUT);
}

function runTsc(root: string): { ok: boolean; output: string } {
  try {
    execSync('npx tsc --noEmit', { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
    return { ok: true, output: '' };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
    return { ok: false, output };
  }
}

async function main() {
  const root = path.join(os.tmpdir(), `gallery-repair-smoke-${Date.now()}`);
  await writeWorkspace(root, BROKEN_SITE_CONFIG);

  log('workspace', root);
  log('needsUpgrade before repair', siteConfigNeedsGalleryTypeUpgrade(BROKEN_SITE_CONFIG));

  log('installing deps (may take ~30s)...');
  execSync('npm install --prefer-offline --no-audit --no-fund', {
    cwd: root,
    stdio: 'inherit',
  });

  const before = runTsc(root);
  log('tsc before repair', { ok: before.ok });
  if (before.ok) {
    console.error('Expected tsc to fail before repair');
    process.exit(1);
  }
  if (!before.output.includes('gallery')) {
    log('tsc stderr excerpt', before.output.slice(0, 500));
  }

  const repaired = await repairSiteConfigTypesInWorkspace(root);
  log('repairSiteConfigTypesInWorkspace', { repaired });

  const afterContent = await fs.readFile(path.join(root, 'src/lib/siteConfig.ts'), 'utf-8');
  log('needsUpgrade after repair', siteConfigNeedsGalleryTypeUpgrade(afterContent));
  log('includes gallery in union', afterContent.includes("'gallery'"));

  const after = runTsc(root);
  log('tsc after repair', { ok: after.ok });
  if (!after.ok) {
    console.error(after.output.slice(-2000));
    process.exit(1);
  }

  log('PASS — gallery type repair fixes local TypeScript build');
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
