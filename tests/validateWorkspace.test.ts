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

  it('strips legacy page sync exports and skips build for tailwind-only edits', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'test', scripts: { build: 'next build' } })
    );
    await fs.writeFile(
      path.join(dir, 'tailwind.config.js'),
      'module.exports = { content: ["./src/**/*"] };\n'
    );
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/app/page.tsx'),
      `export default function Home() { return null; }\nexport const __siteAgentPageGallerySync = 1;\n`
    );

    const result = await validateWorkspace(dir, { changedFiles: ['tailwind.config.js'] });
    expect(result.ok).toBe(true);
    const page = await fs.readFile(path.join(dir, 'src/app/page.tsx'), 'utf-8');
    expect(page).not.toContain('__siteAgentPageGallerySync');
    expect(result.buildLog).toContain('skipping npm run build');
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

const SERVICEPROMAGIC_WS = path.join(
  process.cwd(),
  '.tmp/git-workspaces/6a1bc4fdc795e45980a08f4e/repo'
);

describe.runIf(() => {
  try {
    require('fs').accessSync(SERVICEPROMAGIC_WS);
    return true;
  } catch {
    return false;
  }
})('validateWorkspace production build (ServiceProMagic)', () => {
  it('builds after preview dev left a stale .next cache', async () => {
    await fs.mkdir(path.join(SERVICEPROMAGIC_WS, '.next'), { recursive: true });
    await fs.writeFile(path.join(SERVICEPROMAGIC_WS, '.next', 'BUILD_ID'), 'stale-dev');

    const prevNodeEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true, configurable: true });
    try {
      const result = await validateWorkspace(SERVICEPROMAGIC_WS, { forceFullBuild: true });
      expect(result.ok, result.errors.join('; ') || result.buildLog).toBe(true);
      expect(result.buildLog).toContain('Removed stale .next cache');
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: prevNodeEnv,
        writable: true,
        configurable: true,
      });
    }
  }, 180_000);
});
