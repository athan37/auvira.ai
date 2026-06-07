import type { ClarificationAnchor } from '@/lib/chat/projectMessageMetadata';
import type { EditTarget } from './types';

/** Build persisted clarification anchor from resolved edit target. */
export function clarificationAnchorFromTarget(target: EditTarget): ClarificationAnchor | undefined {
  if (target.kind === 'hero') {
    return { kind: 'hero' };
  }
  if (target.kind === 'section' && target.sectionIndex != null) {
    return {
      kind: 'section',
      sectionIndex: target.sectionIndex,
      title: target.title,
    };
  }
  return undefined;
}
