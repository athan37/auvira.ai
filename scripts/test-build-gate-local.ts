/**
 * Local build gate smoke test (full npm install + next build).
 *
 * Usage:
 *   node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/test-build-gate-local.ts', {stdio:'inherit'})"
 *   VERCEL=1 node ... # should skip npm (fast)
 */

import { generateWebsiteFiles } from '../src/lib/builder/generateWebsiteFiles';
import {
  shouldRunLocalNpmBuildGate,
  validateGeneratedSite,
} from '../src/lib/builder/validateGeneratedSite';
import { getDefaultDesignBrief } from '../src/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '../src/lib/agent/schemas';

const minimalSiteSpec: SiteSpec = {
  siteTitle: 'Local Test HVAC',
  tagline: 'Trusted heating and cooling',
  primaryCTA: 'Call now',
  secondaryCTA: 'Get a quote',
  sections: [
    {
      type: 'hero',
      title: 'Expert HVAC Service',
      body: '24/7 emergency repair and installation.',
      items: ['Licensed', 'Insured', 'Same-day service'],
    },
    {
      type: 'services',
      title: 'Our Services',
      body: 'Full-service HVAC for homes and businesses.',
      items: ['AC repair', 'Furnace install', 'Maintenance plans'],
    },
    {
      type: 'about',
      title: 'About Us',
      body: 'Family-owned since 2010 serving the metro area.',
      items: ['Certified technicians'],
    },
    {
      type: 'contact',
      title: 'Contact',
      body: 'Call 512-555-0199 or email hello@example.com',
      items: ['Mon–Fri 8am–6pm'],
    },
  ],
  designDirection: {
    colors: ['#0ea5e9', '#0369a1'],
    style: 'modern',
  },
};

function log(msg: string, detail?: unknown) {
  console.log(detail !== undefined ? `[build-gate-local] ${msg}: ${JSON.stringify(detail)}` : `[build-gate-local] ${msg}`);
}

async function main() {
  log('shouldRunLocalNpmBuildGate (local)', shouldRunLocalNpmBuildGate());

  const designBrief = getDefaultDesignBrief('home-services');
  const generated = generateWebsiteFiles(minimalSiteSpec, 'local-build-gate-test', designBrief, {
    category: 'home-services',
    variant: 'modern-clean',
  });
  log('generated files', generated.files.length);

  const start = Date.now();
  const result = await validateGeneratedSite({
    files: generated.files,
    projectName: 'local-build-gate-test',
  });
  const elapsed = Date.now() - start;

  log('result', {
    ok: result.ok,
    buildGateSkipped: result.buildGateSkipped ?? false,
    errors: result.errors,
    durationMs: result.durationMs,
    elapsedMs: elapsed,
  });

  if (!result.ok) {
    console.error('\n[build-gate-local] FAILED\n', result.logs.slice(-2000));
    process.exit(1);
  }

  if (process.env.VERCEL === '1' && !result.buildGateSkipped) {
    console.error('[build-gate-local] Expected buildGateSkipped on VERCEL=1');
    process.exit(1);
  }

  if (process.env.VERCEL !== '1' && result.buildGateSkipped) {
    console.error('[build-gate-local] Expected full build gate locally');
    process.exit(1);
  }

  console.log('\n[build-gate-local] PASSED');
}

main().catch((err) => {
  console.error('[build-gate-local] FAILED:', err);
  process.exit(1);
});
