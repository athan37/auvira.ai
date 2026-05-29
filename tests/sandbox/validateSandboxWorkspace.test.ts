import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSandboxWorkspace } from '@/lib/sandbox/validateSandboxWorkspace';

const mockRunCommand = vi.fn();
const mockGetSandbox = vi.fn();
const mockGetGateway = vi.fn();

vi.mock('@/lib/sandbox/sandboxClient', () => ({
  getProjectSandbox: (...args: unknown[]) => mockGetSandbox(...args),
}));

vi.mock('@/lib/sandbox/sandboxWorkspaceGateway', () => ({
  getSandboxGateway: (...args: unknown[]) => mockGetGateway(...args),
}));

vi.mock('@/lib/preview/repairSiteConfigTypes', () => ({
  repairSiteConfigTypesViaGateway: vi.fn().mockResolvedValue(false),
}));

describe('validateSandboxWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSandbox.mockResolvedValue({
      runCommand: mockRunCommand,
    });
  });

  it('skips npm build for tailwind-only edits and strips legacy page exports', async () => {
    const pageWithLegacyExport = `export default function Home() { return null; }
export const __siteAgentPageGallerySync = 123;
`;
    const files = new Map<string, string>([
      ['src/app/page.tsx', pageWithLegacyExport],
      ['src/lib/siteConfig.ts', 'export const siteConfig = {};\n'],
      ['tailwind.config.js', 'module.exports = { content: [] };\n'],
    ]);

    mockRunCommand.mockImplementation(async (opts: { cmd: string; args: string[] }) => {
      if (opts.cmd === 'test') return { exitCode: 0 };
      throw new Error('build should not run');
    });

    mockGetGateway.mockResolvedValue({
      readFile: async (rel: string) => files.get(rel) ?? Promise.reject(new Error('missing')),
      writeFile: async (rel: string, body: string) => {
        files.set(rel, body);
      },
    });

    const result = await validateSandboxWorkspace('proj-1', ['tailwind.config.js']);

    expect(result.ok).toBe(true);
    expect(mockRunCommand).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'npm', args: ['run', 'build'] })
    );
    expect(files.get('src/app/page.tsx')).not.toContain('__siteAgentPageGallerySync');
    expect(result.buildLog).toContain('skipping npm run build');
  });

  it('sanitizes page exports before npm build when edit is not preview-safe', async () => {
    const pageWithLegacyExport = `export default function Home() { return null; }
export const __siteAgentPageGallerySync = 999;
`;
    const files = new Map<string, string>([
      ['src/app/page.tsx', pageWithLegacyExport],
      ['src/lib/siteConfig.ts', 'export const siteConfig = {};\n'],
    ]);

    mockRunCommand.mockImplementation(async (opts: { cmd: string; args: string[] }) => {
      if (opts.cmd === 'test') return { exitCode: 0 };
      if (opts.cmd === 'npm' && opts.args[0] === 'run') {
        const page = files.get('src/app/page.tsx') ?? '';
        if (page.includes('__siteAgentPageGallerySync')) {
          return { exitCode: 1, stdout: async () => '', stderr: async () => 'invalid page export' };
        }
        return { exitCode: 0, stdout: async () => 'ok', stderr: async () => '' };
      }
      return { exitCode: 0, stdout: async () => '', stderr: async () => '' };
    });

    mockGetGateway.mockResolvedValue({
      readFile: async (rel: string) => files.get(rel) ?? Promise.reject(new Error('missing')),
      writeFile: async (rel: string, body: string) => {
        files.set(rel, body);
      },
    });

    const result = await validateSandboxWorkspace('proj-1', ['package.json']);

    expect(result.ok).toBe(true);
    expect(files.get('src/app/page.tsx')).not.toContain('__siteAgentPageGallerySync');
    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'npm', args: ['run', 'build'] })
    );
  });
});
