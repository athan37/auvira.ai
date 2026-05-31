/**
 * Step-through replay of ServiceProMagic hero gradient conversation.
 * Run: node --env-file=.env npx tsx scripts/replicate-servicepromagic-conversation.ts
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import { scratchPath } from '@/lib/runtime/scratchDir';

const SOURCE_WS =
  '.tmp/git-workspaces/6a1bc4fdc795e45980a08f4e/repo';

const HERO_GRADIENT_MSG =
  'change color of the "Your HVAC Website Should Work as Hard as You Do" section\'s background from red to green color gradient';

const FULL_CONVERSATION: Array<{ role: 'user' | 'assistant'; content: string }> = [
  { role: 'user', content: HERO_GRADIENT_MSG },
  {
    role: 'assistant',
    content:
      "Could you please specify the exact green color gradient you'd like for the hero background?",
  },
  { role: 'user', content: 'Linear gradient from #16a34a to #15803d (top to bottom)' },
  {
    role: 'assistant',
    content:
      'Do you mean the **hero** at the top of the page, or the **first content section** below it?',
  },
  { role: 'user', content: 'Hero at the top' },
  {
    role: 'assistant',
    content:
      'Should I apply the gradient to the entire hero background (behind the text), or only to a button or other element within the hero?',
  },
  { role: 'user', content: 'Entire hero background' },
  {
    role: 'assistant',
    content:
      'What gradient style would you like for the hero background? Please specify the colors (e.g., blue to purple) and direction (e.g., left-to-right, diagonal, top-to-bottom).',
  },
  { role: 'user', content: 'Blue to purple, left-to-right' },
  {
    role: 'assistant',
    content:
      'I need one more detail before applying this edit: update_section_style: update_section_style requires sectionIndex',
  },
  { role: 'user', content: 'Specify the section number (e.g. section 2)' },
  {
    role: 'assistant',
    content:
      'Which section should I change? Reply with the number:\n\n1. [0] services — "Everything Your HVAC Website Needs to Succeed"\n2. [1] about — "Why ServiceProMagic?"',
  },
];

async function cloneWorkspace(): Promise<string> {
  const src = path.join(process.cwd(), SOURCE_WS);
  const dest = scratchPath(`servicepromagic-replay-${randomUUID().slice(0, 8)}`);
  await fs.cp(src, dest, { recursive: true });
  return dest;
}

async function inspectStep(
  label: string,
  workspacePath: string,
  ownerMessage: string,
  history: ConversationTurn[]
): Promise<void> {
  const ctx = await buildEditContext({
    workspacePath,
    mode: 'gitlab',
    ownerMessage,
    conversationHistory: history,
    infraBaselineReady: true,
  });

  console.log(`\n=== ${label} ===`);
  console.log('message:', ownerMessage.slice(0, 100));
  console.log('effectiveMessage:', ctx.context.effectiveMessage.slice(0, 120));
  console.log('target:', {
    kind: ctx.context.target.kind,
    sectionIndex: ctx.context.target.sectionIndex,
    title: ctx.context.target.title,
    confidence: ctx.context.target.confidence,
    needsClarification: ctx.context.target.needsClarification,
  });
  if (ctx.needsClarification) {
    console.log('early clarify:', ctx.clarificationMessage?.slice(0, 200));
    return;
  }

  const plan = await planEdit({ editContext: ctx.context, userPrompt: ownerMessage });
  if (!plan.ok || !plan.plan) {
    console.log('plan failed:', plan.error);
    return;
  }
  console.log('plan:', {
    needsClarification: plan.plan.needsClarification,
    clarificationQuestion: plan.plan.clarificationQuestion?.slice(0, 160),
    steps: plan.plan.steps.map((s) => ({ skill: s.skill, params: s.params, target: s.target })),
  });
}

async function runE2E(
  label: string,
  workspacePath: string,
  ownerMessage: string,
  history: ConversationTurn[]
): Promise<void> {
  const result = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage,
    conversationHistory: history,
    projectId: 'replay-test',
    mode: 'gitlab',
    infraBaselineReady: true,
  });
  console.log(`\n=== E2E ${label} ===`);
  console.log({
    ok: result.ok,
    needsClarification: result.needsClarification,
    strategy: result.strategy,
    summary: result.summary?.slice(0, 200),
    ownerMessage: result.ownerMessage?.slice(0, 200),
    error: result.error?.slice(0, 200),
  });
}

async function main(): Promise<void> {
  process.env.SECTION_TARGET_LLM = '1';

  // Step 1: first message, no history
  const ws1 = await cloneWorkspace();
  await inspectStep('Turn 1 — initial request (no history)', ws1, HERO_GRADIENT_MSG, []);

  // Step 2: repeat same message after failed turn 1
  const ws2 = await cloneWorkspace();
  const historyAfterTurn1: ConversationTurn[] = [
    { role: 'user', content: HERO_GRADIENT_MSG },
    {
      role: 'assistant',
      content:
        "Could you please specify the exact green color gradient you'd like for the hero background?",
    },
  ];
  await inspectStep('Turn 2 — repeat request (with prior clarify)', ws2, HERO_GRADIENT_MSG, historyAfterTurn1);

  // Full E2E on fresh workspace — turn 1 only
  const ws3 = await cloneWorkspace();
  await runE2E('Turn 1 E2E', ws3, HERO_GRADIENT_MSG, []);

  // Mid-conversation: after hero confirmed
  const ws4 = await cloneWorkspace();
  const historyMid = FULL_CONVERSATION.slice(0, 6) as ConversationTurn[];
  await inspectStep('Turn 4 — Entire hero background', ws4, 'Entire hero background', historyMid);

  await fs.rm(ws1, { recursive: true, force: true });
  await fs.rm(ws2, { recursive: true, force: true });
  await fs.rm(ws3, { recursive: true, force: true });
  await fs.rm(ws4, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
