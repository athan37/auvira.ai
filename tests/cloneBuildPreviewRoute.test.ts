import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  cloneJobFindOne: vi.fn(),
  cloneJobFindById: vi.fn(),
  cloneJobUpdateOne: vi.fn(),
  ensureClonePreviewProject: vi.fn(),
  buildWebsiteFromPlan: vi.fn(),
  workspacePath: '',
}));

vi.mock('@/lib/api/projectAccess', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/db/models/CloneJob', () => ({
  PREVIEW_STEPS: [
    { key: 'prepare_structure', label: 'Preparing structure' },
    { key: 'create_homepage', label: 'Creating homepage' },
    { key: 'add_services', label: 'Adding services' },
    { key: 'add_about', label: 'Adding about' },
    { key: 'add_contact', label: 'Adding contact' },
    { key: 'apply_style', label: 'Applying style' },
    { key: 'quality_check', label: 'Checking quality' },
    { key: 'start_preview', label: 'Starting preview' },
  ],
  BUILD_SUMMARY_ITEMS: [
    { key: 'hero', label: 'Hero' },
    { key: 'sections', label: 'Sections' },
    { key: 'services', label: 'Services' },
    { key: 'contact', label: 'Contact' },
    { key: 'style', label: 'Style' },
    { key: 'quality', label: 'Quality' },
    { key: 'preview', label: 'Preview' },
  ],
  CloneJob: {
    findOne: mocks.cloneJobFindOne,
    findById: mocks.cloneJobFindById,
    updateOne: mocks.cloneJobUpdateOne,
  },
}));

vi.mock('@/lib/clone/persistClonePreview', () => ({
  ensureClonePreviewProject: mocks.ensureClonePreviewProject,
}));

vi.mock('@/lib/runtime/isVercelServerless', () => ({
  isVercelServerless: vi.fn(() => true),
}));

vi.mock('@/lib/runtime/isCloneSandboxPreviewEnabled', () => ({
  isCloneSandboxPreviewEnabled: vi.fn(() => false),
}));

vi.mock('@/lib/runtime/scratchDir', () => ({
  scratchPath: vi.fn(() => mocks.workspacePath),
}));

vi.mock('@/lib/agent/buildWebsiteFromPlan', () => ({
  buildWebsiteFromPlan: mocks.buildWebsiteFromPlan,
  generateUniqueProjectName: vi.fn((name: string) => `${name}-test`),
}));

import { POST } from '@/app/api/projects/clone/jobs/[jobId]/build-preview/route';

function makeJob(status = 'review_ready') {
  return {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    status,
    sourceUrl: 'https://example.com',
    projectName: 'Example Co',
    businessProfile: { businessName: 'Example Co', industry: 'HVAC', services: ['HVAC'] },
    factualSiteData: {
      businessName: 'Example Co',
      industry: 'HVAC',
      practiceAreasOrServices: ['HVAC'],
      phoneNumbers: [],
      emails: [],
      locations: [],
      testimonials: [],
      alternateNames: [],
      people: [],
      serviceAreas: [],
      ctas: [],
      paymentLinks: [],
      socialLinks: [],
      sourceFacts: [],
      missingCriticalFields: [],
      confidence: { businessIdentity: 0.8, services: 0.8, contactInfo: 0.5, overall: 0.7 },
    },
    proposedWebsitePlan: {
      businessName: 'Example Co',
      industry: 'HVAC',
      positioning: 'Local HVAC',
      targetCustomers: ['Homeowners'],
      primaryGoal: 'Leads',
      recommendedPagesOrSections: [],
      contentPlan: {
        hero: { headline: 'Example Co', subheadline: 'Hello', primaryCTA: 'Call', secondaryCTA: 'Learn' },
        sections: [
          { type: 'services', title: 'Services', purpose: 'List services' },
          { type: 'contact', title: 'Contact', purpose: 'Contact us' },
        ],
      },
      requiredMissingInfo: [],
      optionalMissingInfo: [],
      suggestedTemplate: { category: 'home-services', variant: 'modern-clean', reason: 'test' },
      riskWarnings: [],
    },
    contentFidelity: {
      passed: true,
      issues: ['No phone found in crawl'],
      criticalIssues: [],
      warnIssues: ['No phone found in crawl'],
      hasCriticalFailures: false,
    },
    suggestedTemplate: { category: 'home-services', variant: 'modern-clean', reason: 'test' },
    preview: { status: 'ready', url: 'http://localhost:3001' },
    logs: [],
  };
}

describe('build-preview auto handoff', () => {
  beforeEach(() => {
    mocks.workspacePath = join(process.cwd(), `clone-build-preview-route-${Date.now()}`);
    rmSync(mocks.workspacePath, { recursive: true, force: true });
    mkdirSync(mocks.workspacePath, { recursive: true });
    mocks.requireAuth.mockReset().mockResolvedValue({
      userId: '507f1f77bcf86cd799439013',
    });
    mocks.cloneJobFindOne.mockReset().mockResolvedValue(makeJob());
    mocks.cloneJobFindById.mockReset().mockResolvedValue(makeJob('preview_ready'));
    mocks.cloneJobUpdateOne.mockReset().mockResolvedValue({});
    mocks.ensureClonePreviewProject.mockReset().mockResolvedValue({
      projectId: '507f1f77bcf86cd799439014',
      created: true,
    });
    mocks.buildWebsiteFromPlan.mockReset().mockResolvedValue({
      ok: true,
      siteSpec: {
        siteTitle: 'Example Co',
        sections: [
          { type: 'hero', title: 'Example Co', body: 'Hello', items: [] },
          { type: 'services', title: 'Services', body: 'We help', items: ['HVAC'] },
          { type: 'contact', title: 'Contact', body: 'Call us', items: [] },
        ],
      },
      generated: {
        files: [{ filePath: 'package.json', content: '{"scripts":{"dev":"next dev"}}' }],
      },
      template: { category: 'home-services', variant: 'modern-clean', reason: 'test' },
      uniqueName: 'example-co-test',
      generatedSiteValidation: {
        ok: true,
        logs: 'ok',
        errors: [],
        durationMs: 1,
        tempDir: '/tmp/test',
      },
    });
  });

  afterEach(() => {
    if (mocks.workspacePath) {
      rmSync(mocks.workspacePath, { recursive: true, force: true });
    }
  });

  it('builds preview even when content fidelity has warnings only', async () => {
    const response = await POST({} as never, { params: { jobId: '507f1f77bcf86cd799439011' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('preview_ready');
    expect(mocks.buildWebsiteFromPlan).toHaveBeenCalledTimes(1);
  });

  it('returns a dynamic projectId after preview_ready auto-save succeeds', async () => {
    const response = await POST({} as never, { params: { jobId: '507f1f77bcf86cd799439011' } });
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.status).toBe('preview_ready');
    expect(body.projectId).toBe('507f1f77bcf86cd799439014');
    expect(mocks.ensureClonePreviewProject).toHaveBeenCalledTimes(1);
  });

  it('reuses an already preview_ready project without rebuilding', async () => {
    mocks.cloneJobFindOne.mockResolvedValue({
      ...makeJob('preview_ready'),
      createdProjectId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
    });
    mocks.ensureClonePreviewProject.mockResolvedValue({
      projectId: '507f1f77bcf86cd799439015',
      created: false,
    });

    const response = await POST({} as never, { params: { jobId: '507f1f77bcf86cd799439011' } });
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.projectId).toBe('507f1f77bcf86cd799439015');
    expect(mocks.buildWebsiteFromPlan).not.toHaveBeenCalled();
  });

  it('keeps preview_ready recoverable when auto-save fails', async () => {
    mocks.ensureClonePreviewProject.mockRejectedValue(new Error('GitLab unavailable'));

    const response = await POST({} as never, { params: { jobId: '507f1f77bcf86cd799439011' } });
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.status).toBe('preview_ready');
    expect(body.projectId).toBeUndefined();
    expect(body.autoSave).toEqual({ ok: false, error: 'GitLab unavailable' });
  });
});
