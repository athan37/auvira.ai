import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSandboxWorkspace } from '@/lib/sandbox/validateSandboxWorkspace';

const mockRunCommand = vi.fn();
const mockGetSandbox = vi.fn();
const mockGetGateway = vi.fn();
const mockClearSandboxDevArtifacts = vi.fn();
const mockRestartSandboxDevServer = vi.fn();

vi.mock('@/lib/sandbox/sandboxClient', () => ({
  getProjectSandbox: (...args: unknown[]) => mockGetSandbox(...args),
}));

vi.mock('@/lib/sandbox/sandboxDevServer', () => ({
  clearSandboxDevArtifacts: (...args: unknown[]) => mockClearSandboxDevArtifacts(...args),
  restartSandboxDevServer: (...args: unknown[]) => mockRestartSandboxDevServer(...args),
}));

vi.mock('@/lib/sandbox/sandboxWorkspaceGateway', () => ({
  getSandboxGateway: (...args: unknown[]) => mockGetGateway(...args),
}));

vi.mock('@/lib/preview/repairSiteConfigTypes', () => ({
  repairSiteConfigTypesViaGateway: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/sandbox/repairPreviewSandbox', () => ({
  repairPreviewSandbox: vi.fn().mockResolvedValue(undefined),
}));

describe('validateSandboxWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSandbox.mockResolvedValue({
      runCommand: mockRunCommand,
    });
    mockClearSandboxDevArtifacts.mockResolvedValue(undefined);
    mockRestartSandboxDevServer.mockResolvedValue('https://sandbox.example');
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
    expect(mockClearSandboxDevArtifacts).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'npm', args: ['run', 'build'] })
    );
    expect(mockRestartSandboxDevServer).not.toHaveBeenCalled();
  });

  it('clears dev artifacts, runs build, and restarts preview for deploy gate (no changedFiles)', async () => {
    const files = new Map<string, string>([
      ['src/app/page.tsx', 'export default function Home() { return null; }\n'],
      ['src/lib/siteConfig.ts', 'export const siteConfig = {};\n'],
    ]);

    mockRunCommand.mockImplementation(async (opts: { cmd: string; args: string[] }) => {
      if (opts.cmd === 'test') return { exitCode: 0 };
      if (opts.cmd === 'npm' && opts.args[0] === 'run') {
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

    const result = await validateSandboxWorkspace('proj-deploy');

    expect(result.ok).toBe(true);
    expect(mockClearSandboxDevArtifacts).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'npm', args: ['run', 'build'] })
    );
    expect(mockRestartSandboxDevServer).toHaveBeenCalledWith('proj-deploy');
    expect(result.buildLog).toContain('cleared .next before production build');
  });

  it('skips npm build for section color edits (siteConfig + page + tailwind)', async () => {
    const pageWithLegacyExport = `function ContactSection({ section }) {
  return <section className={"py-20 " + preset.contactBg}>{section.title}</section>;
}
export default function Home() { return null; }
export const __siteAgentPageGallerySync = 1;
`;
    const siteConfigWithPresentation = `export const siteConfig = {
  sections: [{ type: "contact", title: "Contact", presentation: { backgroundClass: "bg-red-600" } }],
};
`;
    const files = new Map<string, string>([
      ['src/app/page.tsx', pageWithLegacyExport],
      ['src/lib/siteConfig.ts', siteConfigWithPresentation],
      ['tailwind.config.js', 'module.exports = { content: ["./src/app/**/*"] };\n'],
    ]);

    mockRunCommand.mockImplementation(async (opts: { cmd: string; args: string[] }) => {
      if (opts.cmd === 'test') return { exitCode: 0 };
      throw new Error('build should not run for preview-safe color edit');
    });

    mockGetGateway.mockResolvedValue({
      readFile: async (rel: string) => files.get(rel) ?? Promise.reject(new Error('missing')),
      writeFile: async (rel: string, body: string) => {
        files.set(rel, body);
      },
    });

    const result = await validateSandboxWorkspace('proj-1', [
      'src/lib/siteConfig.ts',
      'src/app/page.tsx',
      'tailwind.config.js',
    ]);

    expect(result.ok).toBe(true);
    expect(files.get('src/app/page.tsx')).not.toContain('__siteAgentPageGallerySync');
    expect(result.buildLog).toContain('skipping npm run build');
    expect(mockClearSandboxDevArtifacts).not.toHaveBeenCalled();
    expect(mockRunCommand).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'npm', args: ['run', 'build'] })
    );
  });
});
