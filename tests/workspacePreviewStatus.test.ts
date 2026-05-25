import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWorkspaceStatusFromProject } from '@/lib/project-workspace/bootstrapProjectPreview';
import type { IWebsiteProject } from '@/models/WebsiteProject';

function baseProject(overrides: Record<string, unknown> = {}): IWebsiteProject {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    preview: {
      status: 'ready',
      previewMode: 'live',
      url: 'https://customer-site.vercel.app',
    },
    deployment: { liveUrl: 'https://customer-site.vercel.app' },
    codeWorkspace: { status: 'ready', version: 1 },
    gitlab: { repoUrl: 'https://gitlab.com/x/y.git', projectId: 1 },
    ...overrides,
  } as unknown as IWebsiteProject;
}

describe('getWorkspaceStatusFromProject', () => {
  const vercel = process.env.VERCEL;

  afterEach(() => {
    if (vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = vercel;
  });

  it('local dev ignores stale live previewMode and requires dev server port', () => {
    delete process.env.VERCEL;
    const status = getWorkspaceStatusFromProject(baseProject());
    expect(status.previewMode).toBe('workspace');
    expect(status.ready).toBe(false);
    expect(status.previewPort).toBeNull();
  });

  it('local dev uses workspace proxy when preview port is set', () => {
    delete process.env.VERCEL;
    const status = getWorkspaceStatusFromProject(
      baseProject({
        preview: {
          status: 'ready',
          previewMode: 'live',
          url: 'https://customer-site.vercel.app',
          port: 3042,
        },
      })
    );
    expect(status.previewMode).toBe('workspace');
    expect(status.ready).toBe(true);
    expect(status.previewPort).toBe(3042);
  });

  it('vercel uses live mode when previewMode is live', () => {
    process.env.VERCEL = '1';
    process.env.SITE_AGENT_SANDBOX_ENABLED = '0';
    const status = getWorkspaceStatusFromProject(baseProject());
    expect(status.previewMode).toBe('live');
    expect(status.ready).toBe(true);
    expect(status.liveUrl).toBe('https://customer-site.vercel.app');
  });
});
