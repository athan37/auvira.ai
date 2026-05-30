/**
 * Local contact-section color edit against a git workspace.
 * Usage: npx tsx scripts/test-contact-section-color-local.ts [projectId]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { resolveSiteWorkspace } from '../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
import { buildGroundedEditContext } from '../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import { runSectionStyleStrategy } from '../src/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import {
  presentationWiringIssues,
  sectionRendererUsesPresentationResolver,
} from '../src/lib/project-workspace/previewReflectsSiteConfig';
import { colorNameToBackgroundClass } from '../src/lib/builder/sectionPresentation';

const PROJECT_ID = process.argv[2] || '6a14f7316310ebb2c0d88513';
const MESSAGE = 'change background color of the last section to red';

async function main() {
  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  const snap = await resolveSiteWorkspace({ workspacePath, mode: 'gitlab' });
  if (!snap.pageContent || !snap.siteConfigContent) {
    throw new Error('Missing page.tsx or siteConfig.ts in workspace');
  }

  const grounded = await buildGroundedEditContext(snap, MESSAGE, [], workspacePath);
  const plan = grounded.plan;
  if (!plan) throw new Error('No edit plan produced');

  console.log('Section target:', {
    index: plan.where.sectionIndex,
    type: plan.where.sectionType,
    title: plan.where.title,
    component: plan.where.rendererComponent,
  });

  const expectedClass = colorNameToBackgroundClass('red', MESSAGE);
  console.log('Expected class:', expectedClass);

  const wiringBefore = presentationWiringIssues(snap.siteConfigContent, snap.pageContent);
  const contactResolverBefore = sectionRendererUsesPresentationResolver(
    snap.pageContent,
    'ContactSection'
  );
  console.log('Wiring issues before:', wiringBefore);
  console.log('Contact uses resolver before:', contactResolverBefore);

  const result = await runSectionStyleStrategy(
    {
      workspacePath,
      ownerMessage: MESSAGE,
      projectId: PROJECT_ID,
      mode: 'gitlab',
      editTargetPlan: plan,
      infraBaselineReady: true,
    },
    {}
  );

  console.log('Edit result:', result?.ok, result?.summary);

  const siteConfig = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
  const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
  const contactBlock = siteConfig.match(/"type": "contact"[\s\S]{0,400}/)?.[0] ?? '';
  const contactLine =
    page.match(/function ContactSection[\s\S]{0,220}/)?.[0] ?? '';

  console.log('Contact siteConfig snippet:', contactBlock);
  console.log('Contact page snippet:', contactLine);
  console.log('Wiring issues after:', presentationWiringIssues(siteConfig, page));

  if (!siteConfig.includes(`"backgroundClass": "${expectedClass}"`)) {
    throw new Error(`siteConfig missing ${expectedClass} on contact section`);
  }
  if (!contactLine.includes('resolveSectionBackground(section, preset)')) {
    throw new Error('ContactSection still uses preset.contactBg instead of presentation resolver');
  }
  if (!result?.ok) {
    throw new Error('Section style strategy failed');
  }

  console.log('OK: contact section wired and saved with', expectedClass);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
