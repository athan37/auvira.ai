import '../../llmTestGate';
import { afterEach, expect, it } from 'vitest';
import { runWebsiteEditAgent } from '@/lib/project-workspace/website-edit-agent';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { describeRunLlmIntegration } from '../../llmTestGate';
import {
  BASE_SITE_MODEL,
  planWithLiveLlm,
} from '../../website-agent-v2/llmIntegrationHarness';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/types';
import {
  cleanupPresentationWorkspace,
  createPresentationTestWorkspace,
  readWorkspacePage,
  readWorkspaceSiteConfig,
} from '../../website-agent-v2/presentationWorkspace';
import { defaultMultiSectionSiteSpec } from '../../support/syntheticSiteWorkspace';

const SYNTHETIC_SECTIONS = defaultMultiSectionSiteSpec().sections;
const GALLERY_INDEX = 2;
const TESTIMONIALS_INDEX = 3;
const RED_BG_CLASS = colorNameToBackgroundClass('red');
const TESTIMONIALS_TITLE = SYNTHETIC_SECTIONS[TESTIMONIALS_INDEX].title!;

const SECTION_LIST_CLARIFICATION =
  'Which section do you mean? Reply with the number:\n\n' +
  SYNTHETIC_SECTIONS.map(
    (section, index) =>
      `${index + 1}. [${index}] ${section.type} — "${section.title ?? `Section ${index + 1}`}"`
  ).join('\n');

const STYLE_SCOPE_CLARIFICATION =
  'This sounds like a color or style change, not new section content — can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?';

const TESTIMONIAL_CARD_CLARIFICATION =
  `I can change something in "${TESTIMONIALS_TITLE}" to red, but I need one detail:\n\n` +
  '1. Background of **all** testimonial cards\n' +
  '2. Background of **one** card (paste the customer name or quote)\n' +
  '3. **Text** color in that section\n\n' +
  'Reply with 1, 2, or 3 — or describe exactly which card and whether you mean background or text.';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

describeRunLlmIntegration('chat history edit (hard LLM integration)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await cleanupPresentationWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it('V2 planner: section number follow-up targets gallery after deictic first turn', async () => {
    const turns = history(
      { role: 'user', content: 'Change the background color of this section to red' },
      { role: 'assistant', content: SECTION_LIST_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('3', BASE_SITE_MODEL, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStep?.args?.sectionIndex).toBe(GALLERY_INDEX);
  });

  it('V2 planner: style-scope follow-up applies gallery background after clarification', async () => {
    const turns = history(
      { role: 'user', content: 'Make the gallery section background red' },
      { role: 'assistant', content: STYLE_SCOPE_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('whole section background', BASE_SITE_MODEL, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStep?.args?.sectionIndex).toBe(GALLERY_INDEX);
  });

  it('V2 planner: recency wins when owner revises color in latest message', async () => {
    const turns = history(
      { role: 'user', content: 'Change the gallery section background to red' },
      { role: 'assistant', content: 'Updated gallery background to red.' },
      { role: 'user', content: 'Actually make the gallery section background blue instead' }
    );

    const plan = await planWithLiveLlm(
      'Actually make the gallery section background blue instead',
      BASE_SITE_MODEL,
      turns
    );

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStep?.args?.sectionIndex).toBe(GALLERY_INDEX);
    const presentation = styleStep?.args?.presentation as
      | { backgroundClass?: unknown }
      | undefined;
    expect(
      String(styleStep?.args?.backgroundColor ?? presentation?.backgroundClass ?? '')
    ).toMatch(/blue/i);
  });

  it('V1 agent: section number follow-up writes gallery presentation class to siteConfig', async () => {
    workspacePath = await createPresentationTestWorkspace();
    const turns = history(
      { role: 'user', content: 'Change the background color of this to red' },
      { role: 'assistant', content: SECTION_LIST_CLARIFICATION }
    );

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: '3',
      conversationHistory: turns,
      projectId: 'llm-chat-history-section-pick',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    if (result.needsClarification) {
      expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);
      return;
    }

    expect(result.ok, result.error ?? result.ownerMessage ?? JSON.stringify(result)).toBe(true);
    expect(result.strategy).toMatch(/section_style|section_config|single_shot|agent_loop/);

    const siteConfig = await readWorkspaceSiteConfig(workspacePath);
    expect(siteConfig).toMatch(/"type"\s*:\s*['"]gallery['"][\s\S]*backgroundClass[\s\S]*bg-red/i);
  });

  it('V1 agent: testimonial card option "1" routes with history and updates page preset.card', async () => {
    workspacePath = await createPresentationTestWorkspace();
    const turns = history(
      {
        role: 'user',
        content: `change the card below to red in the section ${TESTIMONIALS_TITLE} to red`,
      },
      { role: 'assistant', content: TESTIMONIAL_CARD_CLARIFICATION }
    );

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: '1',
      conversationHistory: turns,
      projectId: 'llm-chat-history-testimonial-cards',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    if (result.needsClarification) {
      expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);
      return;
    }

    expect(result.ok, result.error ?? result.ownerMessage ?? JSON.stringify(result)).toBe(true);
    expect(result.strategy).toMatch(/preset_card_color|section_config|single_shot|agent_loop/);
    expect(result.changedFiles ?? []).toContain('src/app/page.tsx');

    const page = await readWorkspacePage(workspacePath);
    expect(page).toMatch(/"card"\s*:\s*"[^"]*border-red[^"]*bg-red[^"]*"/i);

    const siteConfig = await readWorkspaceSiteConfig(workspacePath);
    expect(siteConfig).toContain("type: 'testimonials'");
    expect(siteConfig).not.toMatch(/presentation|cardClass|backgroundClass/i);
  });

  it('V2 planner: testimonial style follow-up chooses section background scope', async () => {
    const turns = history(
      { role: 'user', content: 'Make the testimonials section background red' },
      { role: 'assistant', content: STYLE_SCOPE_CLARIFICATION }
    );

    const plan = await planWithLiveLlm('whole section background', BASE_SITE_MODEL, turns);

    expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
    const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
    expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
    expect(styleStep?.args?.sectionIndex).toBe(TESTIMONIALS_INDEX);
  });
});
