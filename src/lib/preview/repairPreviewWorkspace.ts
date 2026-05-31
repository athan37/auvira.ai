import { promises as fs } from 'fs';
import path from 'path';
import { instrumentGeneratedSite } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';
import { repairPageTsxStructure } from '@/lib/project-workspace/repairPageTsxStructure';
import { repairSiteConfigTypesInWorkspace } from '@/lib/preview/repairSiteConfigTypes';
import { repairSectionPresentationWiringInWorkspace } from '@/lib/project-workspace/edit-shared/legacySectionPresentation';

/**
 * Fix common template / agent-edit mismatches so `next dev` can render the preview.
 */
export async function repairPreviewWorkspace(workspacePath: string): Promise<void> {
  await repairSiteConfigTypesInWorkspace(workspacePath);
  await repairPageToSiteConfigSchema(workspacePath);
  await ensureSiteConfigNavigation(workspacePath);
  await ensureHeroCtasInSiteConfig(workspacePath);
  await repairSectionPresentationWiringInWorkspace(workspacePath);

  const pagePath = path.join(workspacePath, 'src/app/page.tsx');
  try {
    const page = await fs.readFile(pagePath, 'utf-8');
    const { content, repaired } = repairPageTsxStructure(page);
    if (repaired) {
      await fs.writeFile(pagePath, content, 'utf-8');
    }
  } catch {
    /* optional */
  }

  try {
    await instrumentGeneratedSite({ workspacePath });
  } catch {
    /* analytics / section attrs optional for preview */
  }
}

async function repairPageToSiteConfigSchema(workspacePath: string): Promise<void> {
  const pagePath = path.join(workspacePath, 'src/app/page.tsx');
  try {
    let content = await fs.readFile(pagePath, 'utf-8');
    let changed = false;

    const replacements: Array<[string, string]> = [
      ['siteConfig.hero.title', 'siteConfig.hero.headline'],
      ['siteConfig.hero.subtitle', 'siteConfig.hero.subheadline'],
      ['siteConfig.contact.title', "'Contact Us'"],
      ['siteConfig.contact.subtitle', '(siteConfig.tagline || "")'],
      ['siteConfig.footer.tagline', '(siteConfig.tagline || "")'],
      ['siteConfig.footer.copyright', '(`© ${new Date().getFullYear()} ${siteConfig.businessName}`)'],
      ['siteConfig.navigation.map', '(siteConfig.navigation ?? []).map'],
      ['siteConfig.hero.cta.map', '(siteConfig.hero?.cta ?? []).map'],
      [
        'siteConfig.contact.phone.replace',
        '(siteConfig.contact?.phone || "").replace',
      ],
      [
        'mailto:${siteConfig.contact.email}',
        'mailto:${siteConfig.contact?.email || "hello@example.com"}',
      ],
    ];

    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.split(from).join(to);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(pagePath, content, 'utf-8');
    }
  } catch {
    /* optional file */
  }
}

async function ensureSiteConfigNavigation(workspacePath: string): Promise<void> {
  const configPath = path.join(workspacePath, 'src/lib/siteConfig.ts');
  try {
    let content = await fs.readFile(configPath, 'utf-8');
    if (content.includes('navigation')) return;

    const navBlock = `  "navigation": [
    { "label": "Home", "href": "#top" },
    { "label": "Services", "href": "#services" },
    { "label": "Contact", "href": "#contact" }
  ],
`;

    if (content.includes('"sections":')) {
      content = content.replace(/"sections":/, `${navBlock}  "sections":`);
      await fs.writeFile(configPath, content, 'utf-8');
    }
  } catch {
    /* optional file */
  }
}

async function ensureHeroCtasInSiteConfig(workspacePath: string): Promise<void> {
  const configPath = path.join(workspacePath, 'src/lib/siteConfig.ts');
  try {
    let content = await fs.readFile(configPath, 'utf-8');
    if (content.includes('"cta"')) return;

    const primaryMatch = content.match(/"primaryCta":\s*"([^"]*)"/);
    const secondaryMatch = content.match(/"secondaryCta":\s*"([^"]*)"/);
    const primary = primaryMatch?.[1] || 'Get started';
    const secondary = secondaryMatch?.[1] || 'Contact';

    const ctaBlock = `    "cta": [
      { "label": ${JSON.stringify(primary)}, "href": "#contact" },
      { "label": ${JSON.stringify(secondary)}, "href": "tel:+12816885322" }
    ],
`;

    if (content.includes('"hero":')) {
      content = content.replace(/"secondaryCta":\s*"[^"]*",\s*\n/, (m) => `${m}${ctaBlock}`);
      await fs.writeFile(configPath, content, 'utf-8');
    }
  } catch {
    /* optional file */
  }
}
