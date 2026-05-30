import { describe, it, expect } from 'vitest';
import { summarizeActualChangesTool } from '@/lib/project-workspace/tools/domain/summarizeActualChanges';
import type { DomainToolContext } from '@/lib/project-workspace/tools/domain/types';

describe('summarize_actual_changes', () => {
  it('uses saved backgroundClass not planner text', async () => {
    const before = `export const siteConfig = { sections: [{ type: 'services', title: 'Grow', presentation: {} }] };`;
    const after = `export const siteConfig = { sections: [{ type: 'services', title: 'Grow', presentation: { backgroundClass: 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600' } }] };`;

    const toolCtx: DomainToolContext = {
      editContext: {} as DomainToolContext['editContext'],
      agentOptions: {} as DomainToolContext['agentOptions'],
      changedFiles: ['src/lib/siteConfig.ts'],
      beforeFiles: { 'src/lib/siteConfig.ts': before },
      afterFiles: { 'src/lib/siteConfig.ts': after },
    };

    const result = await summarizeActualChangesTool(toolCtx);
    expect(result.summary).toBe(
      'Changed background of "Grow" to bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600.'
    );
    expect(result.summary).not.toContain('LLM');
  });
});
