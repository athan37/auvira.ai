import '../../llmTestGate';
import { expect, it } from 'vitest';
import { describeRunLlmIntegration } from '../../llmTestGate';
import {
  BASE_SITE_SPEC,
  planWithLiveLlm,
  styleStepBackgroundHint,
  styleStepSectionIndex,
} from '../../support/planWithLiveLlm';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import { defaultMultiSectionSiteSpec } from '../../support/syntheticSiteWorkspace';

const SYNTHETIC_SECTIONS = defaultMultiSectionSiteSpec().sections;
const GALLERY_INDEX = 2;
const TESTIMONIALS_INDEX = 3;

const SECTION_LIST_CLARIFICATION =
  'Which section do you mean? Reply with the number:\n\n' +
  SYNTHETIC_SECTIONS.map(
    (section, index) =>
      `${index + 1}. [${index}] ${section.type} — "${section.title ?? `Section ${index + 1}`}"`
  ).join('\n');

const STYLE_SCOPE_CLARIFICATION =
  'This sounds like a color or style change, not new section content — can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

describeRunLlmIntegration('chat history edit (hard LLM integration)', () => {
  it('V3 planner: section number follow-up targets gallery after deictic first turn', async () => {
    const turns = history(
      { role: 'user', content: 'Change the background color of this section to red' },
      { role: 'assistant', content: SECTION_LIST_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('3', BASE_SITE_SPEC, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStepSectionIndex(styleStep)).toBe(GALLERY_INDEX);
  });

  it('V3 planner: style-scope follow-up applies gallery background after clarification', async () => {
    const turns = history(
      { role: 'user', content: 'Make the gallery section background red' },
      { role: 'assistant', content: STYLE_SCOPE_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('whole section background', BASE_SITE_SPEC, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStepSectionIndex(styleStep)).toBe(GALLERY_INDEX);
  });

  it('V3 planner: recency wins when owner revises color in latest message', async () => {
    const turns = history(
      { role: 'user', content: 'Change the gallery section background to red' },
      { role: 'assistant', content: 'Updated gallery background to red.' },
      { role: 'user', content: 'Actually make the gallery section background blue instead' }
    );

    const plan = await planWithLiveLlm(
      'Actually make the gallery section background blue instead',
      BASE_SITE_SPEC,
      turns
    );

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStepSectionIndex(styleStep)).toBe(GALLERY_INDEX);
    expect(styleStepBackgroundHint(styleStep)).toMatch(/blue/i);
  });

  it('V3 planner: testimonial style follow-up chooses section background scope', async () => {
    const turns = history(
      { role: 'user', content: 'Make the testimonials section background red' },
      { role: 'assistant', content: STYLE_SCOPE_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('whole section background', BASE_SITE_SPEC, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStepSectionIndex(styleStep)).toBe(TESTIMONIALS_INDEX);
  });
});
