/**
 * Live repro for project 6a1f96b65872cf542bda0d08:
 * pinned contact "Get Started Today" + change get in touch btn → hero.primaryCta
 */
import path from 'path';
import { promises as fs } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { extractTargetPhrase } from '@/lib/project-workspace/edit-context/matchSectionElementPhrase';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { llmDescribe } from '../llmTestGate';
import { assertV3EditSucceeded } from './editHarness';
import { readSyntheticFile } from '../support/syntheticSiteWorkspace';
import { LocalFsGateway } from '@/lib/project-workspace/localFsGateway';
import { repairPreviewWorkspace } from '@/lib/preview/repairPreviewWorkspace';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import { getChangedPathsFromHashes } from '@/lib/project-workspace/workspaceDiff';

const PROJECT_ID = '6a1f96b65872cf542bda0d08';
const OWNER_MESSAGE = 'change get in touch btn to hello click on this';
const EXPECTED_CTA = 'hello click on this';

const PINNED_CONTACT = {
  kind: 'section' as const,
  sectionIndex: 4,
  sectionType: 'contact',
  sectionTitle: 'Get Started Today',
  sectionId: 'section_contact_get-started-today_5',
  analyticsId: 'section_contact_get-started-today_5',
  fieldPath: 'hero.primaryCta',
};

function workspacePathForProject(): string {
  return getGitWorkspacePath(PROJECT_ID);
}

async function readSiteConfig(workspacePath: string): Promise<string> {
  return fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
}

describe('project 6a1f96 primary CTA (deterministic)', () => {
  it('extracts target phrase and value from owner message', () => {
    expect(extractTargetPhrase(OWNER_MESSAGE)).toEqual({
      targetPhrase: 'get in touch btn',
      value: EXPECTED_CTA,
    });
  });

  it('buildEditContext resolves pinned contact section at index 4', async () => {
    const workspacePath = workspacePathForProject();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_CONTACT,
    });

    expect(built.needsClarification, built.clarificationMessage).toBe(false);
    expect(built.context.target.sectionIndex).toBe(4);
    expect(built.context.target.sectionType).toBe('contact');

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'hero.primaryCta',
      value: EXPECTED_CTA,
    });
  });

  it('buildEditContext resolves section-only pin (no fieldPath) via phrase matching', async () => {
    const workspacePath = workspacePathForProject();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: {
        kind: 'section',
        sectionIndex: 4,
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        sectionId: 'section_contact_get-started-today_5',
        analyticsId: 'section_contact_get-started-today_5',
      },
    });

    expect(built.needsClarification, built.clarificationMessage).toBe(false);
    const plan = buildDeterministicPlan(built.context);
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'hero.primaryCta',
      value: EXPECTED_CTA,
    });
  });

  it('element pin with targetChain scopes bare copy to pinned phone button only', async () => {
    const workspacePath = workspacePathForProject();
    const phonePin = {
      kind: 'section' as const,
      sectionIndex: 4,
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      sectionId: 'section_contact_get-started-today_5',
      analyticsId: 'section_contact_get-started-today_5',
      fieldPath: 'contact.phone',
      surfaceId: 'contact-phone-button',
      elementKind: 'button',
      elementLabel: 'Phone button',
      pinScope: 'element' as const,
      targetChain: [
        { role: 'section' as const, label: 'Get Started Today', kind: 'contact' },
        { role: 'container' as const, label: 'Contact card', kind: 'inner_card' },
        {
          role: 'element' as const,
          label: 'Phone button',
          kind: 'button',
          fieldPath: 'contact.phone',
          surfaceId: 'contact-phone-button',
        },
      ],
    };

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'change phone to 555-0111',
      infraBaselineReady: true,
      selectedTarget: phonePin,
    });

    expect(built.context.selectedTargetContext?.pinnedElementOnly).toBe(true);
    const plan = buildDeterministicPlan(built.context);
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'contact.phone',
      value: '555-0111',
    });
  });
});

describe('project 6a1f96 stream route simulation', () => {
  const SECTION_ONLY_PIN = {
    kind: 'section' as const,
    sectionIndex: 4,
    sectionType: 'contact',
    sectionTitle: 'Get Started Today',
    sectionId: 'section_contact_get-started-today_5',
    analyticsId: 'section_contact_get-started-today_5',
  };

  it('gateway + repairPreviewWorkspace detects siteConfig hash change', async () => {
    const workspacePath = workspacePathForProject();
    const gateway = new LocalFsGateway(workspacePath);
    const beforeHashes = await gateway.computeHashes();

    const result = await runWebsiteEdit(
      {
        workspacePath,
        ownerMessage: OWNER_MESSAGE,
        projectId: PROJECT_ID,
        mode: 'gitlab',
        gateway,
        selectedTarget: SECTION_ONLY_PIN,
        infraStatus: 'pending',
        infraVersion: 0,
      },
      undefined
    );

    await repairPreviewWorkspace(workspacePath);
    const afterHashes = await gateway.computeHashes();
    const changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);

    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(
      changedPaths,
      `agent changedFiles=${JSON.stringify(result.changedFiles)}`
    ).toContain('src/lib/siteConfig.ts');
  });
});

llmDescribe('project 6a1f96 primary CTA (live edit agent)', () => {
  let workspacePath = workspacePathForProject();
  let siteConfigBefore = '';

  beforeAll(async () => {
    siteConfigBefore = await readSiteConfig(workspacePath);
  });

  afterAll(async () => {
    if (siteConfigBefore) {
      await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfigBefore, 'utf-8');
    }
  });

  it('runWebsiteEditAgent updates hero.primaryCta from pinned contact + btn phrase', async () => {
    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: PROJECT_ID,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: PINNED_CONTACT,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);
    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(after).toMatch(new RegExp(`"primaryCta"\\s*:\\s*${JSON.stringify(EXPECTED_CTA)}`));

    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    expect(page).toContain('siteConfig.hero.primaryCta');
  });

  it('runWebsiteEditAgent updates hero.primaryCta when only the contact section is pinned (no fieldPath)', async () => {
    const sectionOnlyPin = {
      kind: 'section' as const,
      sectionIndex: 4,
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      sectionId: 'section_contact_get-started-today_5',
      analyticsId: 'section_contact_get-started-today_5',
    };

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: PROJECT_ID,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: sectionOnlyPin,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);
    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(after).toMatch(new RegExp(`"primaryCta"\\s*:\\s*${JSON.stringify(EXPECTED_CTA)}`));
  });
});
