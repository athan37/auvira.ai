import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { validateWorkspace } from '../src/lib/project-workspace/validateWorkspace';

describe('validateWorkspace', () => {
  it('fails static workspace without index.html', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    const result = await validateWorkspace(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('index.html'))).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('passes static workspace with index.html', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    await fs.writeFile(path.join(dir, 'index.html'), '<html><body>Hi</body></html>');
    const result = await validateWorkspace(dir);
    expect(result.ok).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('detects package.json and skips build when no build script', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'test', scripts: {} })
    );
    const result = await validateWorkspace(dir);
    expect(result.warnings.some((w) => w.includes('build script'))).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
