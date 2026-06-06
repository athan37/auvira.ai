import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const GENERIC_SITE_CONFIG = `export const siteConfig = {
  sections: [
    {
      type: 'generic',
      title: 'Stay Connected',
      items: [
        { title: 'Value proposition for subscribing', description: 'Card one body' },
        { title: 'Card two', description: 'Card two body' },
      ],
    },
    { type: 'services', title: 'Services', items: [{ title: 'Existing service' }] },
  ],
};`;

function pinnedItemContext(
  message: string,
  overrides: Partial<EditContext> = {}
): EditContext {
  return {
    ownerMessage: message,
    effectiveMessage: message,
    conversationHistory: [],
    siteModel: { siteConfigContent: GENERIC_SITE_CONFIG },
    target: {
      kind: 'section',
      sectionIndex: 0,
      title: 'Stay Connected',
      sectionType: 'generic',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
      fieldPath: 'sections[0].items[1].title',
    },
    selectedTarget: {
      kind: 'section',
      sectionIndex: 0,
      sectionTitle: 'Stay Connected',
      sectionType: 'generic',
      itemIndex: 1,
      fieldPath: 'sections[0].items[1].title',
      targetChain: [
        { role: 'section', label: 'Stay Connected', kind: 'generic' },
        { role: 'container', label: 'Content cards', kind: 'item_grid' },
        { role: 'item', label: 'Item 2', itemIndex: 1, itemPosition: 2 },
        {
          role: 'element',
          kind: 'item_title',
          label: 'Value proposition for subscribing',
          fieldPath: 'sections[0].items[1].title',
          itemIndex: 1,
        },
      ],
    },
    selectedTargetContext: {
      target: {
        kind: 'section',
        sectionIndex: 0,
        sectionTitle: 'Stay Connected',
        sectionType: 'generic',
        itemIndex: 1,
        fieldPath: 'sections[0].items[1].title',
      },
      resolved: {
        kind: 'section',
        sectionIndex: 0,
        sectionTitle: 'Stay Connected',
        sectionType: 'generic',
        confidence: 'high',
      },
      editableFields: [],
      sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      element: {
        kind: 'item_title',
        label: 'Value proposition for subscribing',
        itemIndex: 1,
        fieldPath: 'sections[0].items[1].title',
        currentValue: 'Value proposition for subscribing',
      },
      pinnedElementOnly: true,
      allowedFieldPaths: ['sections[0].items[1].title'],
    },
    sections: [{ index: 0, title: 'Stay Connected', type: 'generic', itemCount: 2 }],
    riskFlags: { level: 'low', reasons: [] },
    workspacePath: '/tmp/test',
    ...overrides,
  } as EditContext;
}

function sectionOnlyContext(message: string): EditContext {
  const ctx = pinnedItemContext(message);
  return {
    ...ctx,
    target: {
      kind: 'section',
      sectionIndex: 0,
      title: 'Stay Connected',
      sectionType: 'generic',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedTarget: {
      kind: 'section',
      sectionIndex: 0,
      sectionTitle: 'Stay Connected',
      sectionType: 'generic',
    },
    selectedTargetContext: {
      ...ctx.selectedTargetContext!,
      target: {
        kind: 'section',
        sectionIndex: 0,
        sectionTitle: 'Stay Connected',
        sectionType: 'generic',
      },
      element: undefined,
    },
  } as EditContext;
}

describe('section item structural deterministic plan', () => {
  it('plans add another card like this with title hello', () => {
    const plan = buildDeterministicPlan(
      pinnedItemContext('add another card like this with title hello')
    );
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('add_section_item');
    expect(plan?.steps[0]?.params?.cloneFromItemIndex).toBe(1);
    expect(plan?.steps[0]?.params?.title).toBe('hello');
  });

  it('plans duplicate this card', () => {
    const plan = buildDeterministicPlan(pinnedItemContext('duplicate this card'));
    expect(plan?.steps[0]?.skill).toBe('duplicate_section_item');
    expect(plan?.steps[0]?.params?.itemIndex).toBe(1);
  });

  it('plans delete this card', () => {
    const plan = buildDeterministicPlan(pinnedItemContext('delete this card'));
    expect(plan?.steps[0]?.skill).toBe('remove_section_item');
    expect(plan?.steps[0]?.params?.itemIndex).toBe(1);
  });

  it('plans add one more like this', () => {
    const plan = buildDeterministicPlan(pinnedItemContext('add one more like this'));
    expect(plan?.steps[0]?.skill).toBe('add_section_item');
    expect(plan?.steps[0]?.params?.cloneFromItemIndex).toBe(1);
  });

  it('plans add a third card titled hello with section pin only', () => {
    const plan = buildDeterministicPlan(sectionOnlyContext('add a third card titled hello'));
    expect(plan?.steps[0]?.skill).toBe('add_section_item');
    expect(plan?.steps[0]?.params?.title).toBe('hello');
    expect(plan?.steps[0]?.params?.cloneFromItemIndex).toBeUndefined();
  });

  it('asks for clarification when duplicate is requested without item pin', () => {
    const plan = buildDeterministicPlan(sectionOnlyContext('duplicate this card'));
    expect(plan?.needsClarification).toBe(true);
    expect(plan?.steps).toHaveLength(0);
  });

  it('does not steal copy edits on pinned title', () => {
    const ctx = pinnedItemContext('change this title to hello');
    const plan = buildDeterministicPlan(ctx);
    expect(plan?.steps.some((s) => s.skill === 'update_config_field')).toBe(true);
    expect(plan?.steps.some((s) => s.skill === 'add_section_item')).toBe(false);
  });

  it('still plans add service for services phrasing', () => {
    const plan = buildDeterministicPlan({
      ...pinnedItemContext('add lawn mowing to services'),
      target: { kind: 'site', confidence: 'high', candidates: [], needsClarification: false },
      selectedTarget: undefined,
      selectedTargetContext: undefined,
    } as EditContext);
    expect(plan?.steps[0]?.skill).toBe('add_service');
  });

  it('still plans category action items separately', () => {
    const plan = buildDeterministicPlan({
      ...pinnedItemContext('Add a service package'),
      target: { kind: 'site', confidence: 'high', candidates: [], needsClarification: false },
      selectedTarget: undefined,
      selectedTargetContext: undefined,
    } as EditContext);
    expect(plan?.steps[0]?.skill).toBe('add_action_item');
  });
});
