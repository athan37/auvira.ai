/**
 * Test ambiguous card-color flow: clarification → follow-up "1" → preset.card red.
 * Usage: npx tsx scripts/test-ambiguous-edit-flow.ts [projectId]
 */

import { readFileSync } from 'fs';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { classifyEditJob } from '../src/lib/project-workspace/website-edit-agent/editJobClassifier';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';

const PROJECT_ID = process.argv[2] || '6a14f7316310ebb2c0d88513';
const PROMPT =
  'change the card below to red in the section what our customers say to red';

const snap = {
  mode: 'gitlab' as const,
  archetype: 'section_loop' as const,
  siteConfigPath: 'src/lib/siteConfig.ts',
  pagePath: 'src/app/page.tsx',
  siteConfigContent: '',
  pageContent: '',
  indexHtmlPath: null,
  siteJsonPath: null,
  stylesPath: null,
  indexHtmlContent: null,
  siteJsonContent: null,
};

async function main() {
  console.log('=== Classifier: first message ===');
  const plan1 = classifyEditJob(PROMPT, [], snap);
  if (!plan1.needsClarification) {
    console.error('FAIL: expected needsClarification');
    process.exit(1);
  }
  if (plan1.primaryStrategy === 'section_config') {
    console.error('FAIL: must not route to section_config');
    process.exit(1);
  }
  console.log('OK:', { strategy: plan1.primaryStrategy, replies: plan1.suggestedReplies?.length });

  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  console.log('\n=== Agent: clarification (no file writes expected) ===');
  const r1 = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage: PROMPT,
    projectId: PROJECT_ID,
    mode: 'gitlab',
  });
  if (!r1.needsClarification) {
    console.error('FAIL: agent should return needsClarification');
    process.exit(1);
  }
  console.log('OK:', r1.ownerMessage?.slice(0, 80) + '...');

  const history = [
    { role: 'user' as const, content: PROMPT },
    { role: 'assistant' as const, content: r1.ownerMessage || '' },
    { role: 'user' as const, content: '1' },
  ];

  console.log('\n=== Classifier: follow-up 1 ===');
  const plan2 = classifyEditJob('1', [], snap, history);
  if (plan2.primaryStrategy !== 'preset_card_color') {
    console.error('FAIL: expected preset_card_color, got', plan2.primaryStrategy);
    process.exit(1);
  }
  console.log('OK:', plan2.primaryStrategy);

  console.log('\n=== Agent: apply card color ===');
  const r2 = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage: '1',
    projectId: PROJECT_ID,
    mode: 'gitlab',
    conversationHistory: history,
  });
  if (!r2.ok) {
    console.error('FAIL:', r2.error);
    process.exit(1);
  }
  if (!r2.changedFiles?.includes('src/app/page.tsx')) {
    console.error('FAIL: expected page.tsx change, got', r2.changedFiles);
    process.exit(1);
  }
  if (r2.changedFiles.includes('src/lib/siteConfig.ts')) {
    console.error('FAIL: siteConfig should not change for card color');
    process.exit(1);
  }

  const page = readFileSync(`${workspacePath}/src/app/page.tsx`, 'utf8');
  const card = page.match(/"card"\s*:\s*"([^"]+)"/)?.[1];
  console.log('preset.card:', card);
  if (!card || !/red/i.test(card)) {
    console.error('FAIL: preset.card should include red');
    process.exit(1);
  }

  console.log('\nPASS: ambiguous flow — clarify then red testimonial cards via page.tsx');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
