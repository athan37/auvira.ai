/**
 * Regression coverage for pinned contact-section copy edits and update_contact verification.
 * Mirrors project 6a1f96b65872cf542bda0d08 failure: pinned "Get Started Today" +
 * "change contact information to helllo this is david".
 */

import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, describe, expect, it } from 'vitest';
import { stableAnalyticsIdForSection } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { executePlan } from '@/lib/project-workspace/edit-agent/executePlan';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { normalizeMisroutedCopyPlan } from '@/lib/project-workspace/edit-agent/planFromConfigTextEdit';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { assertV3EditSucceeded, parseSections } from './editHarness';

const CONTACT_SECTION = {
  type: 'contact',
  title: 'Get Started Today',
  body: 'Ready to get started? Reach out anytime.',
};

const CONTACT_ANALYTICS_ID = stableAnalyticsIdForSection(CONTACT_SECTION, 0);

const OWNER_MESSAGE = 'change contact information to helllo this is david';
const PINNED_TARGET = {
  kind: 'section' as const,
  sectionIndex: 0,
  sectionType: 'contact',
  sectionTitle: 'Get Started Today',
  sectionId: CONTACT_ANALYTICS_ID,
  analyticsId: CONTACT_ANALYTICS_ID,
};

const USER_CONTACT = {
  phone: 'Display phone number provided by user',
  email: '1234@asdfasd.edu',
};

async function createGetStartedTodayWorkspace(): Promise<string> {
  const workspacePath = await createSyntheticWorkspace({
    site: {
      businessName: 'Scratch Demo Co',
      sections: [{ type: 'contact', title: 'Get Started Today' }],
    },
    pageMode: 'wired',
    tailwind: 'canonical',
  });

  const siteConfig = `export const siteConfig = {
  businessName: 'Scratch Demo Co',
  hero: { headline: 'Synthetic hero', subheadline: 'Synthetic tagline' },
  contact: {
    phone: ${JSON.stringify(USER_CONTACT.phone)},
    email: ${JSON.stringify(USER_CONTACT.email)},
  },
  sections: [
    {
      type: 'contact',
      title: 'Get Started Today',
      body: 'Ready to get started? Reach out anytime.',
      analyticsId: ${JSON.stringify(CONTACT_ANALYTICS_ID)},
      items: [],
    },
  ],
};`;

  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
  return workspacePath;
}

function readContactFields(siteConfig: string): { phone?: string; email?: string } {
  const readField = (field: 'phone' | 'email') => {
    const unquotedKeyDoubleValue = siteConfig.match(
      new RegExp(`${field}\\s*:\\s*"([^"]*)"`)
    )?.[1];
    if (unquotedKeyDoubleValue != null) return unquotedKeyDoubleValue;
    const doubleQuotedKey = siteConfig.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`))?.[1];
    if (doubleQuotedKey != null) return doubleQuotedKey;
    return siteConfig.match(new RegExp(`${field}\\s*:\\s*'((?:\\\\'|[^'])*)'`))?.[1]?.replace(/\\'/g, "'");
  };
  return { phone: readField('phone'), email: readField('email') };
}

describe('contact section copy regression (Get Started Today)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it('buildEditContext resolves pinned contact section without clarification', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    expect(built.needsClarification, built.clarificationMessage).toBe(false);
    expect(built.context.target.sectionIndex).toBe(0);
    expect(built.context.target.sectionType).toBe('contact');
  });

  it('deterministic plan targets section body via update_config_field', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: 'helllo this is david',
    });
  });

  it('planEdit deterministic path avoids update_contact', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    const planned = await planEdit({
      editContext: built.context,
      userPrompt: OWNER_MESSAGE,
      deterministicOnly: true,
    });

    expect(planned.ok, planned.error).toBe(true);
    expect(planned.plan?.steps[0]?.skill).toBe('update_config_field');
    expect(planned.plan?.steps.some((step) => step.skill === 'update_contact')).toBe(false);
  });

  it('runWebsiteEditAgent applies section body and leaves global contact unchanged', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(readContactFields(before)).toEqual(USER_CONTACT);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: 'contact-copy-regression',
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');

    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(readContactFields(after)).toEqual(USER_CONTACT);

    const sections = parseSections(after);
    expect(String(sections[0]?.subtitle ?? '')).toBe('helllo this is david');
    expect(String(sections[0]?.title ?? '')).toBe('Get Started Today');
  });

  it('executePlan succeeds when misrouted update_contact plan is rewritten to section copy', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    const misrouted = {
      planVersion: 'website-agent' as const,
      needsClarification: false,
      steps: [
        {
          skill: 'update_contact' as const,
          params: { value: 'helllo this is david', email: USER_CONTACT.email },
        },
      ],
    };

    const plan = normalizeMisroutedCopyPlan(misrouted, built.context);
    const result = await executePlan(plan, built.context, {
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: 'contact-copy-rewrite-exec',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);

    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(readContactFields(after)).toEqual(USER_CONTACT);
    expect(String(parseSections(after)[0]?.subtitle ?? '')).toBe('helllo this is david');
  });

  it('explicit email edit on pinned contact section still updates siteConfig.contact.email', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const message = 'change email to david@example.com';

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: message,
      projectId: 'contact-email-explicit',
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: PINNED_TARGET,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);

    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(readContactFields(after).email).toBe('david@example.com');
    expect(readContactFields(after).phone).toBe(USER_CONTACT.phone);
    expect(String(parseSections(after)[0]?.body ?? '')).toContain('Ready to get started');
  });
});

describe('update_contact verification alignment', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it('executePlan applies phone when plan echoes stale email param (no pinned section)', async () => {
    workspacePath = await createGetStartedTodayWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
    });

    const plan = {
      planVersion: 'website-agent' as const,
      needsClarification: false,
      steps: [
        {
          skill: 'update_contact' as const,
          params: { value: 'helllo this is david', email: USER_CONTACT.email },
        },
      ],
    };

    const result = await executePlan(plan, built.context, {
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: 'contact-field-alignment',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result, result.error ?? result.ownerMessage);

    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(readContactFields(after).phone).toBe('helllo this is david');
    expect(readContactFields(after).email).toBe(USER_CONTACT.email);
  });
});
