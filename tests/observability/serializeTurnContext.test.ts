import { describe, expect, it } from 'vitest';
import {
  classifiedIntentFromMessage,
  inferPreGateBlocked,
  serializeResolvedReferencesForMonitor,
  serializeSelectedTargetForMonitor,
  serializeTargetResolvedForMonitor,
} from '@/lib/observability/serializeTurnContext';

describe('serializeTurnContext', () => {
  it('classifies favorite color requests as style_background', () => {
    expect(classifiedIntentFromMessage('change background to my favorite color')).toBe(
      'style_background'
    );
  });

  it('serializes selected target without preview URLs', () => {
    const payload = serializeSelectedTargetForMonitor({
      kind: 'section',
      sectionIndex: 2,
      sectionTitle: 'Contact Us',
      elementLabel: 'Contact Information',
      fieldPath: 'sections[2].title',
      previewThumbnail: { kind: 'element', previewUrl: 'https://cdn.example.com/thumb.png' },
      targetChain: [{ role: 'section', label: 'Contact Us' }],
    });
    expect(payload?.section_index).toBe(2);
    expect(payload?.element_label).toBe('Contact Information');
    expect(payload).not.toHaveProperty('previewThumbnail');
    expect(payload?.preview_thumbnail).toEqual({ kind: 'element', has_preview: true });
  });

  it('serializes target resolved from clarification anchor', () => {
    const payload = serializeTargetResolvedForMonitor({
      clarificationAnchor: { kind: 'section', sectionIndex: 1, title: 'Contact' },
    });
    expect(payload?.kind).toBe('section');
    expect(payload?.needs_clarification).toBe(true);
  });

  it('serializes resolved references for monitor plan metadata', () => {
    const rows = serializeResolvedReferencesForMonitor([
      {
        phrase: 'my favorite color',
        resolvedValue: 'green',
        resolvedKind: 'color',
        source: 'chat_history',
        confidence: 'high',
        reason: 'Resolved from prior chat turn',
      },
    ]);
    expect(rows?.[0]?.resolved_value).toBe('green');
  });

  it('infers pre-gate blocked for clarification without planner path', () => {
    expect(inferPreGateBlocked({ needsClarification: true })).toBe(true);
    expect(inferPreGateBlocked({ needsClarification: true, plannerPath: 'llm' })).toBe(false);
    expect(inferPreGateBlocked({ needsClarification: true, plannerPath: 'clarification' })).toBe(
      true
    );
  });
});
