import { describe, it, expect } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import {
  enrichEditPrompt,
  hasExplicitEditTarget,
} from '../../src/lib/project-workspace/website-edit-agent/enrichEditPrompt';
import { buildSiteSectionCatalog } from '../../src/lib/project-workspace/website-edit-agent/siteSectionCatalog';
import type { EditTargetPlan } from '../../src/lib/project-workspace/website-edit-agent/types';

describe('enrichEditPrompt', () => {
  it('detects explicit vs vague edit targets', () => {
    expect(hasExplicitEditTarget('Change the hero headline')).toBe(false);
    expect(hasExplicitEditTarget('Change the hero headline to Built for Houston')).toBe(true);
    expect(hasExplicitEditTarget('update the main hero headline to: Built for Houston Homeowners')).toBe(
      true
    );
  });

  it('includes siteConfig snapshot and current headline for vague hero requests', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'enrich-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      `export const siteConfig = { hero: { headline: "Welcome to Our Shop" } };`,
      'utf-8'
    );

    const enriched = await enrichEditPrompt(dir, 'gitlab', 'Change the hero headline', 'copy');

    expect(enriched.agentPrompt).toContain('Welcome to Our Shop');
    expect(enriched.agentPrompt).toContain('src/lib/siteConfig.ts');
    expect(enriched.agentPrompt).toContain('write_file');
    expect(enriched.agentPrompt).toContain('Change the hero headline');
    expect(enriched.contextFiles).toContain('src/lib/siteConfig.ts');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('includes section architecture guidance for FAQ requests', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'enrich-faq-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      `export const siteConfig = { sections: [{ type: "about", title: "About" }] };`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(dir, 'src/app/page.tsx'),
      `export default function Page() { return siteConfig.sections.map(...); case "faq": return <FaqSection />; }`,
      'utf-8'
    );

    const enriched = await enrichEditPrompt(
      dir,
      'gitlab',
      'add an FAQ section with exactly 3 questions and answers about our services',
      'section'
    );

    expect(enriched.agentPrompt).toContain('siteConfig.sections');
    expect(enriched.agentPrompt).toContain('type: "faq"');
    expect(enriched.agentPrompt).toContain('write_file on src/lib/siteConfig.ts');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('always includes SITE STRUCTURE MAP when where confidence is low', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'enrich-catalog-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    const siteConfigContent = `export const siteConfig = {
  sections: [
    { type: "services", title: "Our Products", items: [] },
    { type: "testimonials", title: "What Our Customers Say", items: [] },
  ],
};`;
    const pageContent = `export default function Page() { return null; }`;
    await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), siteConfigContent, 'utf-8');
    await fs.writeFile(path.join(dir, 'src/app/page.tsx'), pageContent, 'utf-8');

    const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
    const editTargetPlan: EditTargetPlan = {
      where: {
        confidence: 'low',
        kind: 'section',
        matches: [],
        clarificationMessage: 'Which section?',
      },
      what: 'style_background',
      valueExplicit: false,
      codeBlocks: [],
      structureBrief: catalog.textBlock,
      sectionCatalog: catalog,
    };

    const enriched = await enrichEditPrompt(
      dir,
      'gitlab',
      'change this section background to blue',
      'style',
      [],
      undefined,
      [],
      editTargetPlan
    );

    expect(enriched.agentPrompt).toContain('SITE STRUCTURE MAP');
    expect(enriched.agentPrompt).toContain('AVAILABLE HOMEPAGE SECTIONS');
    expect(enriched.agentPrompt).toContain('Our Products');

    await fs.rm(dir, { recursive: true, force: true });
  });
});
