import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({
  cloneJobFindById: vi.fn(),
  cloneJobUpdateOne: vi.fn(),
  commitFilesToGitLab: vi.fn(),
  createGitLabProject: vi.fn(),
  projectActionCreate: vi.fn(),
  projectSave: vi.fn(),
  workspacePath: '',
}));

vi.mock('@/lib/db/models/CloneJob', () => ({
  CloneJob: {
    findById: mocks.cloneJobFindById,
    updateOne: mocks.cloneJobUpdateOne,
  },
}));

vi.mock('@/lib/gitlab/createProject', () => ({
  createGitLabProject: mocks.createGitLabProject,
}));

vi.mock('@/lib/gitlab/commitFiles', () => ({
  commitFilesToGitLab: mocks.commitFilesToGitLab,
}));

vi.mock('@/models/ProjectAction', () => ({
  ProjectAction: {
    create: mocks.projectActionCreate,
  },
}));

vi.mock('@/models/WebsiteProject', () => {
  class MockWebsiteProject {
    _id = { toString: () => 'created-project-id' };

    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }

    save = mocks.projectSave;

    static findOne = vi.fn();
  }

  return { WebsiteProject: MockWebsiteProject };
});

vi.mock('@/lib/clone/ensureClonePreviewWorkspace', () => ({
  ensureClonePreviewWorkspace: vi.fn(async () => mocks.workspacePath),
}));

vi.mock('@/lib/analytics/generated-sites/instrumentGeneratedSite', () => ({
  instrumentGeneratedFiles: vi.fn((files) => ({ files, publicSiteKey: 'public-site-key' })),
}));

vi.mock('@/lib/analytics/config/websiteAnalyticsConfigService', () => ({
  createWebsiteAnalyticsConfigForProject: vi.fn(),
  deploymentOrigins: vi.fn(() => []),
  ensureWebsiteAnalyticsConfig: vi.fn(),
}));

import { ensureClonePreviewProject } from '@/lib/clone/persistClonePreview';

function selectLeanResult(value: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    sourceUrl: 'https://example.com',
    projectName: 'Example Co',
    businessProfile: { businessName: 'Example Co', industry: 'HVAC' },
    previewSiteSpec: {
      siteTitle: 'Example Co',
      sections: [{ type: 'hero', title: 'Example Co', body: 'Hello', items: [] }],
    },
    suggestedTemplate: { category: 'home-services', variant: 'modern-clean', reason: 'test' },
    ...overrides,
  } as unknown as import('@/lib/db/models/CloneJob').ICloneJob;
}

describe('ensureClonePreviewProject', () => {
  beforeEach(() => {
    mocks.workspacePath = join(process.cwd(), `clone-project-test-${Date.now()}`);
    mkdirSync(mocks.workspacePath, { recursive: true });
    writeFileSync(join(mocks.workspacePath, 'package.json'), '{"scripts":{"dev":"next dev"}}');
    writeFileSync(join(mocks.workspacePath, 'app.tsx'), 'export default function App() { return null; }');
    mocks.cloneJobFindById.mockReset();
    mocks.cloneJobUpdateOne.mockReset().mockResolvedValue({});
    mocks.commitFilesToGitLab.mockReset().mockResolvedValue({ id: 'commit-sha' });
    mocks.createGitLabProject.mockReset().mockResolvedValue({
      id: 123,
      web_url: 'https://gitlab.example/project',
      http_url_to_repo: 'https://gitlab.example/project.git',
      path_with_namespace: 'owner/project',
    });
    mocks.projectActionCreate.mockReset().mockResolvedValue({});
    mocks.projectSave.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    if (mocks.workspacePath) {
      rmSync(mocks.workspacePath, { recursive: true, force: true });
    }
  });

  it('returns an existing createdProjectId without saving again', async () => {
    const result = await ensureClonePreviewProject(
      makeJob({ createdProjectId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012') }),
      '507f1f77bcf86cd799439013'
    );

    expect(result).toEqual({ projectId: '507f1f77bcf86cd799439012', created: false });
    expect(mocks.createGitLabProject).not.toHaveBeenCalled();
  });

  it('creates one project and reuses it on repeated calls', async () => {
    mocks.cloneJobFindById
      .mockReturnValueOnce(selectLeanResult(null))
      .mockReturnValueOnce(selectLeanResult({ createdProjectId: 'created-project-id' }));

    const job = makeJob();
    const first = await ensureClonePreviewProject(job, '507f1f77bcf86cd799439013');
    const second = await ensureClonePreviewProject(job, '507f1f77bcf86cd799439013');

    expect(first).toEqual({ projectId: 'created-project-id', created: true });
    expect(second).toEqual({ projectId: 'created-project-id', created: false });
    expect(mocks.createGitLabProject).toHaveBeenCalledTimes(1);
    expect(mocks.commitFilesToGitLab).toHaveBeenCalledTimes(1);
  });
});
