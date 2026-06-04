/**
 * Project 6a1f96: inner card heading "Contact Information" → sections[4].subtitle
 */
import path from 'path';
import { promises as fs } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import {
  extractTargetPhrase,
} from '@/lib/project-workspace/edit-context/matchSectionElementPhrase';
import { extractReplacementValue } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { llmDescribe } from '../llmTestGate';
import { assertV3EditSucceeded } from './editHarness';
import { readSyntheticFile } from '../support/syntheticSiteWorkspace';
import { parseSections } from './editHarness';

const PROJECT_ID = '6a1f96b65872cf542bda0d08';
const OWNER_MESSAGE =
  'change contact information title of the card to "this is david"';
const EXPECTED_SUBTITLE = 'this is david';

const PINNED_CONTACT = {
  kind: 'section' as const,
  sectionIndex: 4,
  sectionType: 'contact',
  sectionTitle: 'Get Started Today',
  sectionId: 'section_contact_get-started-today_5',
  analyticsId: 'section_contact_get-started-today_5',
};

function workspacePathForProject(): string {
  return getGitWorkspacePath(PROJECT_ID);
}

describe('project 6a1f96 contact card title (deterministic)', () => {
  it('extracts value from quoted card title phrasing', () => {
    expect(extractReplacementValue(OWNER_MESSAGE)).toBe(EXPECTED_SUBTITLE);
  });

  it('extractTargetPhrase parses card title target phrase', () => {
    const parsed = extractTargetPhrase(OWNER_MESSAGE);
    expect(parsed?.value).toBe(EXPECTED_SUBTITLE);
    expect(parsed?.targetPhrase.toLowerCase()).toContain('contact information');
  });

  it('resolveConfigTextEdit targets sections[4].subtitle on real workspace', async () => {
    const siteConfig = await fs.readFile(
      path.join(workspacePathForProject(), 'src/lib/siteConfig.ts'),
      'utf-8'
    );
    const result = resolveConfigTextEdit({
      message: OWNER_MESSAGE,
      siteConfigContent: siteConfig,
      pinnedSectionIndex: 4,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[4].subtitle');
      expect(result.value).toBe(EXPECTED_SUBTITLE);
    }
  });

  it('buildDeterministicPlan targets sections[4].subtitle for pinned contact', async () => {
    const built = await buildEditContext({
      workspacePath: workspacePathForProject(),
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_CONTACT,
    });
    expect(built.needsClarification, built.clarificationMessage).toBe(false);
    expect(built.context.target.sectionIndex).toBe(4);

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[4].subtitle',
      value: EXPECTED_SUBTITLE,
    });
  });
});

llmDescribe('project 6a1f96 contact card title (live edit agent)', () => {
  let workspacePath = workspacePathForProject();
  let siteConfigBefore = '';

  beforeAll(async () => {
    siteConfigBefore = await fs.readFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      'utf-8'
    );
  });

  afterAll(async () => {
    if (siteConfigBefore) {
      await fs.writeFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        siteConfigBefore,
        'utf-8'
      );
    }
  });

  it('runWebsiteEditAgent updates inner card heading subtitle', async () => {
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
    expect(String(parseSections(after)[4]?.subtitle ?? '')).toBe(EXPECTED_SUBTITLE);
  });
});
