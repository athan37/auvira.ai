/**
 * Live repro: project 6a26cc3deeea946b980a52da
 * Pin: Contact · Contact Us › Contact card
 * Message: change background to my favorite color
 */
import path from 'path';
import { promises as fs } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { sectionPresentationCardClass } from '@/lib/project-workspace/previewReflectsSiteConfig';
import { parseSections, sectionBackgroundClass } from '../edit-agent/editHarness';

const PROJECT_ID = '6a26cc3deeea946b980a52da';
const SOURCE_WORKSPACE = path.join(process.cwd(), '.tmp/git-workspaces', PROJECT_ID, 'repo');
const OWNER_MESSAGE = 'change background to my favorite color';
/** Contact Us is sections[13] (analytics id suffix _14 is 1-based ordinal). */
const CONTACT_SECTION_INDEX = 13;

const PINNED_CONTACT_CARD = {
  kind: 'section' as const,
  sectionIndex: CONTACT_SECTION_INDEX,
  sectionType: 'contact',
  sectionTitle: 'Contact Us',
  sectionId: 'section_contact_contact-us_14',
  analyticsId: 'section_contact_contact-us_14',
  pinScope: 'section' as const,
  targetChain: [
    { role: 'section' as const, kind: 'contact', label: 'Contact Us' },
    { role: 'container' as const, kind: 'inner_card', label: 'Contact card' },
  ],
};

const MONITOR_INTENT = {
  sentence:
    "Change the Contact Us background (sections[13]) to red, the owner's favorite color.",
};

describe(`project ${PROJECT_ID} contact card favorite color`, () => {
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

  it('routes pinned contact card to cardClass with resolved red color', async () => {
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      selectedTarget: PINNED_CONTACT_CARD,
      infraBaselineReady: true,
    });

    expect(built.context.target.sectionIndex).toBe(CONTACT_SECTION_INDEX);
    expect(built.context.selectedTargetContext?.pinnedPresentationField).toBe('cardClass');

    const implicit = await resolveImplicitReferences({
      ownerMessage: OWNER_MESSAGE,
      editContext: built.context,
      projectIntent: MONITOR_INTENT,
    });
    expect(implicit.needsClarification).toBeUndefined();
    expect(implicit.references[0]?.resolvedValue).toBe('red');

    const ctx = {
      ...built.context,
      effectiveMessage: implicit.resolvedMessage ?? OWNER_MESSAGE,
    };
    const plan = buildDeterministicPlan(ctx);
    expect(plan?.steps[0]?.skill).toBe('update_section_style');
    expect(plan?.steps[0]?.params?.presentationField).toBe('cardClass');
    expect(String(plan?.steps[0]?.params?.backgroundColor)).toBe('red');
  });

  it('runWebsiteEditAgent applies visible red cardClass (not gray)', async () => {
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      selectedTarget: PINNED_CONTACT_CARD,
      infraBaselineReady: true,
    });
    const implicit = await resolveImplicitReferences({
      ownerMessage: OWNER_MESSAGE,
      editContext: built.context,
      projectIntent: MONITOR_INTENT,
    });
    const ctx = {
      ...built.context,
      effectiveMessage: implicit.resolvedMessage ?? OWNER_MESSAGE,
    };
    const planResult = await planEdit({
      editContext: ctx,
      userPrompt: OWNER_MESSAGE,
      projectIntent: MONITOR_INTENT,
    });

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: PROJECT_ID,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget: PINNED_CONTACT_CARD,
      projectIntent: MONITOR_INTENT,
    });

    const after = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf8');
    const sections = parseSections(after);
    const contact = sections[CONTACT_SECTION_INDEX] ?? {};
    const sectionBg = sectionBackgroundClass(contact);
    const cardClass = sectionPresentationCardClass(after, CONTACT_SECTION_INDEX);

    const contactBlock = after.match(
      /"type": "contact"[\s\S]*?"analyticsId": "section_contact_contact-us_14"[\s\S]*?\n    \}/
    )?.[0];
    const debug = {
      plannerPath: planResult.plannerPath,
      steps: planResult.plan?.steps,
      effectiveMessage: ctx.effectiveMessage,
      ok: result.ok,
      strategy: result.strategy,
      changedFiles: result.changedFiles,
      cardClass,
      sectionBg,
      contactBlock,
    };

    expect(result.needsClarification, result.ownerMessage ?? result.error).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(cardClass, 'cardClass should be set on inner contact card').toBeTruthy();
    expect(cardClass!.toLowerCase(), JSON.stringify(debug, null, 2)).toMatch(/red/);
    expect(cardClass!.toLowerCase()).not.toMatch(/gray|grey|slate|neutral/);
    expect(sectionBg, 'outer section background should be unchanged').toBeUndefined();
  }, 120_000);
});
