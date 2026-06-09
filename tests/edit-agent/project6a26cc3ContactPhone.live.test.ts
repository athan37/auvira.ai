/**
 * Live repro: project 6a26cc3deeea946b980a52da
 * Pin: Contact · Contact Us › Contact card › Contact Information
 * Message: add my phone number 1234 1234123 123
 */
import path from 'path';
import { promises as fs } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { applyPinnedElementScopeGuard } from '@/lib/project-workspace/planner/guardPinnedElementScope';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';

const PROJECT_ID = '6a26cc3deeea946b980a52da';
const SOURCE_WORKSPACE = path.join(
  process.cwd(),
  '.tmp/git-workspaces',
  PROJECT_ID,
  'repo'
);
const OWNER_MESSAGE = 'add my phone number 1234 1234123 123';
const CONTACT_SECTION_INDEX = 13;

const PINNED_CONTACT_INFORMATION = {
  kind: 'section' as const,
  sectionIndex: CONTACT_SECTION_INDEX,
  sectionType: 'contact',
  sectionTitle: 'Contact Us',
  sectionId: 'section_contact_contact-us_14',
  analyticsId: 'section_contact_contact-us_14',
  fieldPath: `sections[${CONTACT_SECTION_INDEX}].subtitle`,
  elementKind: 'heading',
  elementLabel: 'Contact Information',
  pinScope: 'element' as const,
  targetChain: [
    { role: 'section' as const, kind: 'contact', label: 'Contact Us' },
    { role: 'container' as const, kind: 'inner_card', label: 'Contact card' },
    {
      role: 'element' as const,
      kind: 'heading',
      label: 'Contact Information',
      fieldPath: `sections[${CONTACT_SECTION_INDEX}].subtitle`,
    },
  ],
};

function readContactPhone(siteConfig: string): string | undefined {
  const literal = extractSiteConfigObjectLiteral(siteConfig);
  if (!literal) return undefined;
  const parsed = new Function(`return (${literal})`)() as {
    contact?: { phone?: string };
  };
  return parsed.contact?.phone;
}

describe(`project ${PROJECT_ID} contact phone pin repro`, () => {
  let workspacePath = '';
  let siteConfigBefore = '';

  beforeAll(async () => {
    const exists = await fs
      .access(SOURCE_WORKSPACE)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      throw new Error(`Workspace missing: ${SOURCE_WORKSPACE}`);
    }
    workspacePath = SOURCE_WORKSPACE;
    siteConfigBefore = await fs.readFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      'utf8'
    );
  }, 30_000);

  afterAll(async () => {
    if (workspacePath && siteConfigBefore) {
      await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfigBefore, 'utf8');
    }
  });

  it('wiring: pinned Contact Information is element-only subtitle scope', async () => {
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      selectedTarget: PINNED_CONTACT_INFORMATION,
      infraBaselineReady: true,
    });
    expect(built.context.selectedTargetContext?.pinnedElementOnly).toBe(true);
    expect(built.context.selectedTargetContext?.allowedFieldPaths).toEqual([
      `sections[${CONTACT_SECTION_INDEX}].subtitle`,
    ]);
  });

  it('unified resolver extracts phone from add-my-phone phrasing', async () => {
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      selectedTarget: PINNED_CONTACT_INFORMATION,
      infraBaselineReady: true,
    });
    const resolved = resolveConfigTextEdit({
      message: built.context.effectiveMessage,
      siteConfigContent: built.context.siteModel.siteConfigContent ?? '',
      pinnedSectionIndex: built.context.target.sectionIndex,
      selectedTargetContext: built.context.selectedTargetContext,
    });
    expect(resolved.kind).toBe('apply');
    if (resolved.kind === 'apply') {
      expect(resolved.fieldPath).toBe('contact.phone');
      expect(resolved.value).toBe('1234 1234123 123');
    }
    const plan = buildDeterministicPlan(built.context);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'contact.phone',
      value: '1234 1234123 123',
    });
  });

  it('runWebsiteEditAgent applies contact.phone despite Contact Information pin', async () => {
    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: PROJECT_ID,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: PINNED_CONTACT_INFORMATION,
    });

    const after = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf8');
    const phone = readContactPhone(after);

    if (!result.ok) {
      // Surface planner/guard outcome for debugging
      const built = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: OWNER_MESSAGE,
        selectedTarget: PINNED_CONTACT_INFORMATION,
        infraBaselineReady: true,
      });
      const planResult = await planEdit({ editContext: built.context, userPrompt: OWNER_MESSAGE });
      const guarded = planResult.plan
        ? applyPinnedElementScopeGuard(planResult.plan, built.context)
        : null;
      console.log('agent result', {
        ok: result.ok,
        needsClarification: result.needsClarification,
        ownerMessage: result.ownerMessage,
        error: result.error,
        plannerPath: planResult.plannerPath,
        planSteps: planResult.plan?.steps,
        guardedClarification: guarded?.needsClarification,
        guardedQuestion: guarded?.clarificationQuestion,
      });
    }

    expect(result.needsClarification, result.ownerMessage ?? result.error).toBeFalsy();
    expect(result.ok, result.ownerMessage ?? result.error).toBe(true);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
    expect(phone).toBe('1234 1234123 123');
  }, 120_000);
});
