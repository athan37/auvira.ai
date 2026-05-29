import { describe, it, expect } from 'vitest';
import { buildEditJobFilePatch } from '@/lib/project-workspace/editJobFileDiff';

describe('buildEditJobFilePatch', () => {
  it('builds unified diff for modified lines', () => {
    const result = buildEditJobFilePatch(
      'src/lib/siteConfig.ts',
      {
        before: 'export const x = 1;\nexport const y = 2;\n',
        after: 'export const x = 1;\nexport const y = 99;\n',
        afterMayBeStale: true,
      },
      'modified'
    );
    expect(result.patch).toContain('-export const y = 2;');
    expect(result.patch).toContain('+export const y = 99;');
    expect(result.status).toBe('modified');
  });

  it('shows added file as all insertions', () => {
    const result = buildEditJobFilePatch(
      'src/new.ts',
      { before: null, after: 'hello\n', afterMayBeStale: false },
      'added'
    );
    expect(result.patch).toContain('+hello');
    expect(result.beforeLineCount).toBe(0);
  });

  it('shows deleted file as all removals', () => {
    const result = buildEditJobFilePatch(
      'src/old.ts',
      { before: 'bye\n', after: null, afterMayBeStale: false },
      'deleted'
    );
    expect(result.patch).toContain('-bye');
    expect(result.afterLineCount).toBe(0);
  });
});
