import { describe, it, expect } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { readFileTool } from '../../src/lib/project-workspace/edit-shared/tools/readFile';
import { writeFileTool } from '../../src/lib/project-workspace/edit-shared/tools/writeFile';
import type { ToolContext } from '../../src/lib/project-workspace/edit-shared/types';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/minimal-next-site');

function makeCtx(workspacePath: string): ToolContext {
  return {
    workspacePath,
    mode: 'gitlab',
    ownerMessage: 'test',
    changedFiles: [],
    beforeFiles: {},
    afterFiles: {},
    recordChange: (rel) => {
      /* tracked via changedFiles in tests */
    },
  };
}

describe('website edit tools', () => {
  it('read_file returns globals.css content', async () => {
    const ctx = makeCtx(FIXTURE);
    const result = await readFileTool({ path: 'src/app/globals.css' }, ctx);
    expect(result.ok).toBe(true);
    expect(String(result.content)).toContain('background');
  });

  it('write_file rejects .env', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    const ctx = makeCtx(dir);
    const result = await writeFileTool({ path: '.env', content: 'SECRET=x' }, ctx);
    expect(result.ok).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('write_file writes safe file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    const changed: string[] = [];
    const ctx: ToolContext = {
      ...makeCtx(dir),
      changedFiles: changed,
      recordChange: (rel) => changed.push(rel),
    };
    const result = await writeFileTool(
      { path: 'src/app/test.txt', content: 'hello' },
      ctx
    );
    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(dir, 'src/app/test.txt'), 'utf-8');
    expect(content).toBe('hello');
    await fs.rm(dir, { recursive: true, force: true });
  });
});
