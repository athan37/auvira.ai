import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { normalizeMisroutedCopyPlan } from '@/lib/project-workspace/edit-agent/planFromConfigTextEdit';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';

const PROJECT_ID = '6a1f96b65872cf542bda0d08';
const OWNER_MESSAGE = 'change get in touch btn to hello click on this';
const SECTION_PIN = {
  kind: 'section' as const,
  sectionIndex: 4,
  sectionType: 'contact',
  sectionTitle: 'Get Started Today',
  sectionId: 'section_contact_get-started-today_5',
  analyticsId: 'section_contact_get-started-today_5',
};

describe('normalizeMisroutedCopyPlan preserves hero.primaryCta', () => {
  it('does not rewrite get in touch btn plan away from hero.primaryCta', async () => {
    const workspacePath = getGitWorkspacePath(PROJECT_ID);
    const siteConfig = await fs.promises.readFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      'utf-8'
    );

    const resolved = resolveConfigTextEdit({
      message: OWNER_MESSAGE,
      siteConfigContent: siteConfig,
      pinnedSectionIndex: 4,
    });
    expect(resolved.kind).toBe('apply');
    if (resolved.kind === 'apply') {
      expect(resolved.fieldPath).toBe('hero.primaryCta');
    }

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: SECTION_PIN,
    });

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'hero.primaryCta',
      value: 'hello click on this',
    });

    const normalized = normalizeMisroutedCopyPlan(plan!, built.context);
    expect(normalized.steps[0]?.params).toMatchObject({
      fieldPath: 'hero.primaryCta',
      value: 'hello click on this',
    });
  });
});
