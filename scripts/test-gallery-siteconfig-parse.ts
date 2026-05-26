/**
 * Parse + stamp round-trip for siteConfig.ts (no dev server).
 *
 * Usage:
 *   npx tsx scripts/test-gallery-siteconfig-parse.ts
 *   npx tsx scripts/test-gallery-siteconfig-parse.ts path/to/siteConfig.ts
 */

import { readFileSync } from 'fs';
import path from 'path';
import { parseSiteConfigSource, describeSiteConfigParseFailure } from '../src/lib/site-manager/siteConfigParser';
import { stampSiteConfigForGalleryPreviewReload } from '../src/lib/project-workspace/website-edit-agent/gallerySiteConfig';

const fixture = `export const siteConfig: SiteConfig = {
  "hero": { "headline": "Test" },
  "sections": [{ "type": "about", "title": "Intro", "items": [] }]
};`;

function main(): void {
  const fileArg = process.argv[2];
  const source = fileArg
    ? readFileSync(path.resolve(fileArg), 'utf-8')
    : fixture;

  const before = parseSiteConfigSource(source);
  if (!before) {
    console.error('FAIL parse before:', describeSiteConfigParseFailure(source));
    process.exit(1);
  }

  const stamped = stampSiteConfigForGalleryPreviewReload(source);
  const after = parseSiteConfigSource(stamped);
  if (!after?.sections?.length) {
    console.error('FAIL parse after stamp:', describeSiteConfigParseFailure(stamped));
    process.exit(1);
  }

  console.log({
    file: fileArg ?? '(built-in fixture)',
    sectionsBefore: before.sections.length,
    sectionsAfter: after.sections.length,
    hasHeroInSource: stamped.includes('"hero"'),
    syncExport: stamped.includes('__siteAgentGallerySync'),
  });
  console.log('\nPASS: stamp + parse round-trip');
}

main();
