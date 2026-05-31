/**
 * Live clone preview auto-handoff: MongoDB + GitLab + workspace rehydration.
 *
 * Run: RUN_CLONE_HANDOFF_E2E=1 npm run test -- tests/integration/clonePreviewAutoHandoff.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { connectMongoDB } from '@/lib/mongodb';
import { CloneJob, type ICloneJob } from '@/lib/db/models/CloneJob';
import { ensureClonePreviewProject } from '@/lib/clone/persistClonePreview';
import { getClonePreviewProjectPath } from '@/lib/clone/cloneBuildPreviewResponse';
import { WebsiteProject } from '@/models/WebsiteProject';
import { User } from '@/models/User';

const RUN_E2E = process.env.RUN_CLONE_HANDOFF_E2E === '1';

function hasGitLabConfig(): boolean {
  return Boolean(process.env.GITLAB_TOKEN?.trim() && process.env.GITLAB_GROUP_ID?.trim());
}

const previewSiteSpec = {
  siteTitle: 'Handoff E2E HVAC',
  tagline: 'Auto-save integration test',
  primaryCTA: 'Get started',
  secondaryCTA: 'Contact',
  sections: [
    { type: 'hero', title: 'Handoff E2E HVAC', body: 'Trusted local HVAC', items: [] },
    {
      type: 'services',
      title: 'Everything Your HVAC Business Needs to Thrive',
      body: 'Services for contractors',
      items: ['Web design', 'Lead capture'],
    },
    { type: 'contact', title: 'Contact', body: 'Reach us today', items: ['Phone: 555-0100'] },
  ],
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#1E3A5F'] },
};

describe.runIf(RUN_E2E)('clone preview auto-handoff (live E2E)', () => {
  let ownerId: mongoose.Types.ObjectId;
  let job: ICloneJob;
  let projectId: string | undefined;

  beforeAll(async () => {
    if (!hasGitLabConfig()) {
      throw new Error(
        'RUN_CLONE_HANDOFF_E2E=1 requires GITLAB_TOKEN and GITLAB_GROUP_ID in .env'
      );
    }
    await connectMongoDB();

    let user = await User.findOne().sort({ createdAt: 1 });
    if (!user) {
      user = await User.create({
        name: 'Clone Handoff E2E',
        email: `clone-handoff-e2e-${Date.now()}@example.com`,
        authProvider: 'google',
        authProviderId: `e2e-${Date.now()}`,
      });
    }
    ownerId = user._id;

    job = await CloneJob.create({
      ownerId,
      sourceUrl: 'https://example-hvac.test',
      projectName: 'Handoff E2E HVAC',
      status: 'preview_ready',
      currentStageLabel: 'Preview is ready!',
      progressPercent: 75,
      businessProfile: { businessName: 'Handoff E2E HVAC', industry: 'HVAC' },
      previewSiteSpec,
      proposedWebsitePlan: previewSiteSpec,
      suggestedTemplate: {
        category: 'home-services',
        variant: 'modern-clean',
        reason: 'E2E test',
      },
      preview: { status: 'ready', url: 'http://127.0.0.1:3999', port: 3999 },
    });
  }, 120_000);

  afterAll(async () => {
    if (job?._id) {
      await CloneJob.deleteOne({ _id: job._id });
    }
    if (projectId) {
      await WebsiteProject.deleteOne({ _id: projectId });
    }
    await mongoose.disconnect();
  });

  it(
    'ensureClonePreviewProject creates WebsiteProject and idempotent replay reuses it',
    async () => {
      const first = await ensureClonePreviewProject(job, ownerId.toString());
      expect(first.projectId).toBeTruthy();
      expect(first.created).toBe(true);
      projectId = first.projectId;

      const project = await WebsiteProject.findById(first.projectId);
      expect(project).toBeTruthy();
      expect(project?.gitlab?.projectId).toBeTruthy();
      expect(project?.mode).toBe('clone');

      const refreshedJob = await CloneJob.findById(job._id);
      expect(refreshedJob?.createdProjectId?.toString()).toBe(first.projectId);

      const second = await ensureClonePreviewProject(refreshedJob!, ownerId.toString());
      expect(second).toEqual({ projectId: first.projectId, created: false });

      const editorPath = getClonePreviewProjectPath({ projectId: first.projectId });
      expect(editorPath).toBe(`/projects/${encodeURIComponent(first.projectId)}`);
    },
    180_000
  );
});

describe.skipIf(RUN_E2E)('clone preview auto-handoff (live E2E)', () => {
  it('skipped — set RUN_CLONE_HANDOFF_E2E=1 to run live Mongo + GitLab handoff test', () => {});
});
