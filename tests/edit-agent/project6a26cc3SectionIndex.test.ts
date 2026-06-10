import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { findSectionByAnalyticsId } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { resolveSelectedTarget } from '@/lib/project-workspace/edit-context/resolveSelectedTarget';
import { colorNameToCardClass } from '@/lib/builder/sectionPresentation';

const WORKSPACE = path.join(
  process.cwd(),
  '.tmp/git-workspaces/6a26cc3deeea946b980a52da/repo'
);

describe('project 6a26cc3 section index wiring', () => {
  it('resolves Contact Us analytics id to sections[13] (id suffix _14 is 1-based)', () => {
    let content: string;
    try {
      content = readFileSync(path.join(WORKSPACE, 'src/lib/siteConfig.ts'), 'utf8');
    } catch {
      return;
    }

    const found = findSectionByAnalyticsId(content, 'section_contact_contact-us_14');
    expect(found.found).toBe(true);
    expect(found.sectionIndex).toBe(13);
    expect(found.section?.type).toBe('contact');

    const catalog = buildSiteSectionCatalog(content, '');
    const target = resolveSelectedTarget(
      {
        kind: 'section',
        sectionIndex: 12,
        sectionType: 'contact',
        sectionTitle: 'Contact Us',
        sectionId: 'section_contact_contact-us_14',
        analyticsId: 'section_contact_contact-us_14',
        pinScope: 'section',
        targetChain: [
          { role: 'section', kind: 'contact', label: 'Contact Us' },
          { role: 'container', kind: 'inner_card', label: 'Contact card' },
        ],
      },
      catalog,
      content
    );

    expect(target?.sectionIndex).toBe(13);
    expect(target?.reason).toContain('index corrected');
  });

  it('maps favorite color red to a visibly red cardClass (not pale gray)', () => {
    const cardClass = colorNameToCardClass('red');
    expect(cardClass.toLowerCase()).toMatch(/red/);
    expect(cardClass).not.toBe('bg-gray-600');
    expect(cardClass).toBe('bg-red-600');
  });
});
