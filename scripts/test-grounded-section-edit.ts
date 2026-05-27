/**
 * Live grounded section edit flow on a real project workspace.
 * Usage: npx tsx scripts/test-grounded-section-edit.ts [projectId]
 */

import { buildGroundedEditContext } from '../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import { classifyEditJob } from '../src/lib/project-workspace/website-edit-agent/editJobClassifier';
import { resolveSiteWorkspace } from '../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';

const PROJECT_ID = process.argv[2] || '6a14f7316310ebb2c0d88513';

const SCENARIOS = [
  'change background of first section to yellow',
  'edit text of testimonials section',
  'change testimonials section title to "Happy Clients"',
];

async function runScenario(
  snap: Awaited<ReturnType<typeof resolveSiteWorkspace>>,
  message: string
) {
  console.log(`\n=== ${message} ===`);
  const grounded = await buildGroundedEditContext(snap, message, [], getGitWorkspacePath(PROJECT_ID));

  if (grounded.needsClarification) {
    console.log('Clarification:', grounded.clarificationMessage?.slice(0, 120));
    console.log('Suggested replies:', grounded.suggestedReplies?.length ?? 0);
    return;
  }

  const plan = grounded.plan;
  console.log('WHERE:', {
    index: plan?.where.sectionIndex,
    type: plan?.where.sectionType,
    title: plan?.where.title,
    confidence: plan?.where.confidence,
  });
  console.log('WHAT:', plan?.what, 'valueExplicit:', plan?.valueExplicit);
  console.log('Code blocks:', plan?.codeBlocks.map((b) => b.label).join(', '));

  const job = classifyEditJob(message, [], snap, [], plan);
  console.log('Route:', {
    strategy: job.primaryStrategy,
    tier: job.tier,
    needsClarification: job.needsClarification ?? false,
  });
}

async function main() {
  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  console.log('Project:', PROJECT_ID);
  console.log('Workspace:', workspacePath);

  const snap = await resolveSiteWorkspace({ workspacePath, mode: 'gitlab' });
  if (!snap.siteConfigContent || !snap.pageContent) {
    console.error('FAIL: missing siteConfig or page.tsx in workspace');
    process.exit(1);
  }

  for (const message of SCENARIOS) {
    await runScenario(snap, message);
  }

  console.log('\nOK: grounded section edit scenarios completed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
