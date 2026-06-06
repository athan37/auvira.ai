import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function baseContext(message: string, overrides: Partial<EditContext> = {}): EditContext {
  return {
    effectiveMessage: message,
    ownerMessage: message,
    conversationHistory: [],
    siteModel: { siteConfigContent: 'export const siteConfig = { sections: [] };' },
    target: { kind: 'site', confidence: 'high' },
    riskFlags: { level: 'low', reasons: [] },
    workspacePath: '/tmp/test',
    ...overrides,
  } as EditContext;
}

describe('category action deterministic plan', () => {
  it('plans add service package', () => {
    const plan = buildDeterministicPlan(baseContext('Add a service package'));
    expect(plan?.steps[0]?.skill).toBe('add_action_item');
    expect(plan?.steps[0]?.params?.actionType).toBe('quote');
  });

  it('plans add donation tier', () => {
    const plan = buildDeterministicPlan(baseContext('Add a donation tier'));
    expect(plan?.steps[0]?.skill).toBe('add_action_item');
    expect(plan?.steps[0]?.params?.actionType).toBe('donate');
  });

  it('plans add RSVP section', () => {
    const plan = buildDeterministicPlan(baseContext('Add an RSVP section'));
    expect(plan?.steps[0]?.skill).toBe('add_actions_section');
    expect(plan?.steps[0]?.params?.moduleKind).toBe('event_rsvp');
  });

  it('plans multiple menu items from list', () => {
    const plan = buildDeterministicPlan(baseContext('Add these items: Latte, Muffin, Cookie'));
    expect(plan?.steps.length).toBe(3);
    expect(plan?.steps.every((s) => s.skill === 'add_action_item')).toBe(true);
    expect(plan?.steps[0]?.params?.actionType).toBe('buy');
  });

  it('plans pinned valueLabel update', () => {
    const plan = buildDeterministicPlan(
      baseContext('Change this price to "From $149"', {
        target: {
          kind: 'action_value',
          sectionIndex: 0,
          confidence: 'high',
          fieldPath: 'sections[0].actionItems[0].valueLabel',
        },
      })
    );
    expect(plan?.steps[0]?.skill).toBe('update_action_item');
    expect(plan?.steps[0]?.params?.valueLabel).toBe('From $149');
  });

  it('plans pinned ctaLabel update', () => {
    const plan = buildDeterministicPlan(
      baseContext('Change this button to "Request Quote"', {
        target: {
          kind: 'action_cta',
          sectionIndex: 0,
          confidence: 'high',
          fieldPath: 'sections[0].actionItems[0].ctaLabel',
        },
      })
    );
    expect(plan?.steps[0]?.skill).toBe('update_action_item');
    expect(plan?.steps[0]?.params?.ctaLabel).toBe('Request Quote');
  });
});
