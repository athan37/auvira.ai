import { describe, expect, it } from 'vitest';
import { guardPinnedElementScope } from '@/lib/project-workspace/planner/guardPinnedElementScope';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { SelectedTargetContext } from '@/lib/project-workspace/edit-context/selectedTargetContext';

function minimalContext(selectedTargetContext: SelectedTargetContext): EditContext {
  return {
    effectiveMessage: 'change to Hello',
    selectedTargetContext,
    target: { sectionIndex: 4, confidence: 'high', candidates: [], needsClarification: false },
  } as unknown as EditContext;
}

describe('guardPinnedElementScope', () => {
  it('blocks copy steps outside allowedFieldPaths when element pin is active', () => {
    const ctx: SelectedTargetContext = {
      target: {
        kind: 'section',
        sectionIndex: 4,
        fieldPath: 'contact.phone',
        pinScope: 'element',
      },
      resolved: { kind: 'section', sectionIndex: 4, confidence: 'high' },
      editableFields: [],
      sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      pinnedElementOnly: true,
      allowedFieldPaths: ['contact.phone'],
    };

    const blocked = guardPinnedElementScope(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_config_field',
            params: { fieldPath: 'sections[4].subtitle', value: 'Hello' },
          },
        ],
      },
      minimalContext(ctx)
    );

    expect(blocked?.plan?.needsClarification).toBe(true);
    expect(blocked?.plan?.clarificationQuestion).toContain('contact.phone');
  });

  it('allows copy steps on the pinned field path', () => {
    const ctx: SelectedTargetContext = {
      target: {
        kind: 'section',
        sectionIndex: 4,
        fieldPath: 'contact.phone',
        pinScope: 'element',
      },
      resolved: { kind: 'section', sectionIndex: 4, confidence: 'high' },
      editableFields: [],
      sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      pinnedElementOnly: true,
      allowedFieldPaths: ['contact.phone'],
    };

    const blocked = guardPinnedElementScope(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_config_field',
            params: { fieldPath: 'contact.phone', value: '555-0100' },
          },
        ],
      },
      minimalContext(ctx)
    );

    expect(blocked).toBeNull();
  });
});
