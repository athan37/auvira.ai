/**
 * Contract scenarios for inner-element (cardClass) style edits with pinned sections.
 */

import { expect } from 'vitest';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import {
  sectionPresentationBackgroundClass,
  sectionPresentationCardClass,
} from '@/lib/project-workspace/previewReflectsSiteConfig';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createInnerElementStyleWorkspace,
  DEFAULT_EXISTING_CARD_CLASS,
  DEFAULT_SECTION_BACKGROUND,
  type InnerElementSectionSpec,
  type InnerElementStyleWorkspaceSpec,
} from './innerElementStyleWorkspace';
import { destroySyntheticWorkspace, readSyntheticFile } from './syntheticSiteWorkspace';

export type InnerElementStyleExpectation = {
  /** cardClass should change; backgroundClass should stay as before. */
  mode: 'inner-card';
  cardPattern: RegExp;
  /** cardClass must differ from this when set (e.g. pre-existing card class). */
  cardMustDifferFrom?: string;
} | {
  /** backgroundClass should change; cardClass unchanged. */
  mode: 'section-background';
  backgroundPattern: RegExp;
  cardMustStay?: string;
};

export type InnerElementStyleScenario = {
  id: string;
  workspace: InnerElementStyleWorkspaceSpec;
  ownerMessage: string;
  expect: InnerElementStyleExpectation;
};

const SERVICE_ITEMS: InnerElementSectionSpec['items'] = [
  { title: 'AC Repair', description: 'Emergency cooling' },
  { title: 'Heating', description: 'Furnace tune-ups' },
];

const TESTIMONIAL_ITEMS: InnerElementSectionSpec['items'] = [
  { title: 'Jane D.', description: 'Excellent service!' },
  { title: 'Mike R.', description: 'Highly recommend.' },
];

const FAQ_ITEMS: InnerElementSectionSpec['items'] = [
  { title: 'What areas do you serve?', description: 'We serve the metro area.' },
  { title: 'Are you licensed?', description: 'Yes, fully licensed and insured.' },
];

const GALLERY_ITEMS: InnerElementSectionSpec['items'] = [
  {
    title: 'Project A',
    description: 'Kitchen remodel',
    imageUrl: 'https://picsum.photos/seed/a/800/600',
  },
  {
    title: 'Project B',
    description: 'Bathroom upgrade',
    imageUrl: 'https://picsum.photos/seed/b/800/600',
  },
];

export const INNER_ELEMENT_STYLE_LLM_SCENARIOS: InnerElementStyleScenario[] = [
  {
    id: 'contact-information-gradient',
    workspace: {
      section: {
        type: 'contact',
        title: 'hi, this hema',
        body: 'Ready to transform your business?',
      },
      existingBackgroundClass: 'bg-gradient-to-r from-green-600 via-green-500 to-red-600',
    },
    ownerMessage: 'edit the contact information background to green to red gradient',
    expect: {
      mode: 'inner-card',
      cardPattern: /gradient/i,
    },
  },
  {
    id: 'services-cards-blue',
    workspace: {
      section: {
        type: 'services',
        title: 'Our Services',
        body: 'What we offer',
        items: SERVICE_ITEMS,
      },
    },
    ownerMessage: 'change the service cards background to blue',
    expect: {
      mode: 'inner-card',
      cardPattern: /blue/i,
    },
  },
  {
    id: 'testimonials-cards-purple',
    workspace: {
      section: {
        type: 'testimonials',
        title: 'What Clients Say',
        items: TESTIMONIAL_ITEMS,
      },
    },
    ownerMessage: 'make the testimonial cards purple',
    expect: {
      mode: 'inner-card',
      cardPattern: /purple/i,
    },
  },
  {
    id: 'faq-cards-yellow',
    workspace: {
      section: {
        type: 'faq',
        title: 'Common Questions',
        items: FAQ_ITEMS,
      },
    },
    ownerMessage: 'update the FAQ card backgrounds to yellow',
    expect: {
      mode: 'inner-card',
      cardPattern: /yellow/i,
    },
  },
  {
    id: 'gallery-photo-frames-gradient',
    workspace: {
      section: {
        type: 'gallery',
        title: 'Our Work',
        items: GALLERY_ITEMS,
      },
    },
    ownerMessage: 'change the gallery photo frames to a blue to yellow gradient',
    expect: {
      mode: 'inner-card',
      cardPattern: /gradient|blue|yellow/i,
    },
  },
  {
    id: 'features-card-red',
    workspace: {
      section: {
        type: 'features',
        title: 'Why Choose Us',
        items: [
          { title: 'Fast', description: 'Same-day service' },
          { title: 'Trusted', description: '20 years experience' },
        ],
      },
    },
    ownerMessage: 'change the feature card background to red',
    expect: {
      mode: 'inner-card',
      cardPattern: /red/i,
    },
  },
  {
    id: 'contact-whole-section-black',
    workspace: {
      section: {
        type: 'contact',
        title: 'Contact Us',
        body: 'Reach out anytime',
      },
      existingCardClass: DEFAULT_EXISTING_CARD_CLASS,
    },
    ownerMessage: 'change the whole section background to black',
    expect: {
      mode: 'section-background',
      backgroundPattern: /black/i,
      cardMustStay: DEFAULT_EXISTING_CARD_CLASS,
    },
  },
  {
    id: 'pinned-services-with-about-prefix',
    workspace: {
      prefixSections: [{ type: 'about', title: 'About Us' }],
      section: {
        type: 'services',
        title: 'Our Services',
        items: SERVICE_ITEMS,
      },
    },
    ownerMessage: 'make the service cards background red',
    expect: {
      mode: 'inner-card',
      cardPattern: /red/i,
    },
  },
];

export async function withInnerElementStyleScenario(
  scenario: InnerElementStyleScenario,
  run: (input: {
    workspacePath: string;
    targetSectionIndex: number;
    analyticsId: string;
    existingBackgroundClass: string;
    result: WebsiteEditAgentResult;
    siteConfigAfter: string;
  }) => void | Promise<void>
): Promise<void> {
  const created = await createInnerElementStyleWorkspace(scenario.workspace);
  try {
    const result = await runWebsiteEditAgent({
      workspacePath: created.workspacePath,
      ownerMessage: scenario.ownerMessage,
      projectId: `llm-inner-element-${scenario.id}`,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: {
        kind: 'section',
        sectionIndex: created.targetSectionIndex,
        sectionType: scenario.workspace.section.type,
        sectionTitle: scenario.workspace.section.title,
        sectionId: created.analyticsId,
        analyticsId: created.analyticsId,
      },
    });

    const siteConfigAfter = await readSyntheticFile(
      created.workspacePath,
      'src/lib/siteConfig.ts'
    );

    await run({
      workspacePath: created.workspacePath,
      targetSectionIndex: created.targetSectionIndex,
      analyticsId: created.analyticsId,
      existingBackgroundClass: created.existingBackgroundClass,
      result,
      siteConfigAfter,
    });
  } finally {
    await destroySyntheticWorkspace(created.workspacePath);
  }
}

/** Assert agent result matches inner-card or section-background expectation. */
export function assertInnerElementStyleContract(input: {
  scenario: InnerElementStyleScenario;
  targetSectionIndex: number;
  existingBackgroundClass: string;
  result: WebsiteEditAgentResult;
  siteConfigAfter: string;
}): void {
  const { scenario, targetSectionIndex, existingBackgroundClass, result, siteConfigAfter } =
    input;
  const detail = result.error ?? result.ownerMessage ?? result.summary ?? '';

  expect(result.needsClarification, detail).toBeFalsy();
  expect(result.ok, detail).toBe(true);

  const sectionBg = sectionPresentationBackgroundClass(
    siteConfigAfter,
    targetSectionIndex
  );
  const cardClass = sectionPresentationCardClass(siteConfigAfter, targetSectionIndex);

  if (scenario.expect.mode === 'inner-card') {
    expect(sectionBg, 'section background should be unchanged').toBe(
      existingBackgroundClass
    );
    expect(cardClass, 'cardClass should be set on inner element').toBeTruthy();
    expect(cardClass!, detail).toMatch(scenario.expect.cardPattern);
    if (scenario.expect.cardMustDifferFrom) {
      expect(cardClass).not.toBe(scenario.expect.cardMustDifferFrom);
    }
    return;
  }

  expect(sectionBg, detail).toBeTruthy();
  expect(sectionBg!, detail).toMatch(scenario.expect.backgroundPattern);
  if (scenario.expect.cardMustStay) {
    expect(cardClass ?? DEFAULT_EXISTING_CARD_CLASS).toBe(scenario.expect.cardMustStay);
  }
}
