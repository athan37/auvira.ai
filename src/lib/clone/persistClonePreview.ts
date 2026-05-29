import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';
import type { ICloneJob } from '@/lib/db/models/CloneJob';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { WebsiteProject, type IWebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { ensureClonePreviewWorkspace } from '@/lib/clone/ensureClonePreviewWorkspace';
import { instrumentGeneratedFiles } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';
import {
  createWebsiteAnalyticsConfigForProject,
  deploymentOrigins,
  ensureWebsiteAnalyticsConfig,
} from '@/lib/analytics/config/websiteAnalyticsConfigService';

const SKIP_DIRS = ['node_modules', '.next', '.git'];

export type WorkspaceFile = { filePath: string; content: string };

/**
 * Read generated site files from the clone preview workspace (skips binaries and large files).
 */
export function readWorkspaceFiles(workspacePath: string): WorkspaceFile[] {
  const files: WorkspaceFile[] = [];

  function walk(dir: string, base: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      const relativePath = join(base, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.length < 500_000) {
            files.push({ filePath: relativePath, content });
          }
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  walk(workspacePath, '');
  return files;
}

export function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
}

export interface SaveClonePreviewResult {
  project: IWebsiteProject;
  created: boolean;
  gitlabProjectId: number;
  repoUrl: string;
}

async function appendJobLog(
  jobId: mongoose.Types.ObjectId,
  stage: string,
  message: string
) {
  await CloneJob.updateOne(
    { _id: jobId },
    { $push: { logs: { timestamp: new Date(), stage, message } } }
  );
}

/**
 * Persist clone preview workspace to GitLab and ensure a WebsiteProject exists.
 * Safe to call again after preview-chat edits (re-commits files).
 */
export async function saveClonePreviewToGitLab(
  job: ICloneJob,
  userId: string
): Promise<SaveClonePreviewResult> {
  const workspacePath = await ensureClonePreviewWorkspace(job);

  let files = readWorkspaceFiles(workspacePath);
  if (files.length === 0) {
    throw new Error('No files found in preview workspace');
  }
  let analyticsPublicSiteKey = '';

  const jobId = job._id;
  const ownerId = new mongoose.Types.ObjectId(userId);
  const businessName =
    (job.businessProfile as { businessName?: string } | undefined)?.businessName ||
    job.projectName ||
    'generated-site';

  if (job.createdProjectId) {
    const project = await WebsiteProject.findOne({
      _id: job.createdProjectId,
      ownerId,
    });
    if (!project?.gitlab?.projectId) {
      throw new Error('Saved project not found or missing GitLab link.');
    }

    await appendJobLog(jobId, 'save', 'Updating GitLab with latest preview files');
    try {
      const analyticsConfig = await ensureWebsiteAnalyticsConfig({
        project,
        allowedOrigins: deploymentOrigins(project),
      });
      const instrumented = instrumentGeneratedFiles(files, {
        publicSiteKey: analyticsConfig.publicSiteKey,
      });
      files = instrumented.files;
      analyticsPublicSiteKey = instrumented.publicSiteKey;
    } catch (analyticsError) {
      console.warn('[clone/save] Analytics instrumentation failed:', analyticsError);
    }

    const commit = await commitFilesToGitLab({
      projectId: project.gitlab.projectId,
      branch: project.gitlab.defaultBranch || 'main',
      commitMessage: 'Update: preview changes saved',
      files,
    });

    const commitSha = (commit as { id?: string })?.id;
    project.siteSpec = (job.previewSiteSpec || job.proposedWebsitePlan) as unknown as IWebsiteProject['siteSpec'];
    if (commitSha) {
      project.gitlab.lastCommitSha = commitSha;
    }
    project.hasUnpublishedChanges = true;
    project.lastPreviewEditedAt = new Date();
    await project.save();

    await CloneJob.updateOne(
      { _id: jobId },
      {
        $set: {
          currentStageLabel: 'Saved to GitLab — continue editing anytime',
        },
      }
    );

    return {
      project,
      created: false,
      gitlabProjectId: project.gitlab.projectId,
      repoUrl: project.gitlab.webUrl || project.gitlab.repoUrl,
    };
  }

  const uniqueName = generateUniqueProjectName(businessName);
  await appendJobLog(jobId, 'save', 'Creating GitLab repository');
  const instrumented = instrumentGeneratedFiles(files);
  files = instrumented.files;
  analyticsPublicSiteKey = instrumented.publicSiteKey;

  const gitlabResult = await createGitLabProject({ name: uniqueName });
  await appendJobLog(jobId, 'save', `GitLab project created: ${gitlabResult.id}`);

  const commit = await commitFilesToGitLab({
    projectId: gitlabResult.id,
    commitMessage: 'Initial commit: generated website preview',
    files,
  });
  const commitSha = (commit as { id?: string })?.id;

  const project = new WebsiteProject({
    ownerId,
    mode: 'clone',
    name: businessName,
    sourceUrl: job.sourceUrl,
    siteSpec: (job.previewSiteSpec || job.proposedWebsitePlan) as unknown as IWebsiteProject['siteSpec'],
    businessProfile: job.businessProfile,
    factualSiteData: job.factualSiteData,
    template: job.suggestedTemplate,
    generatedSiteValidation: job.generatedSiteValidation,
    gitlab: {
      projectId: gitlabResult.id,
      repoUrl: gitlabResult.web_url,
      httpUrlToRepo: gitlabResult.http_url_to_repo,
      webUrl: gitlabResult.web_url,
      pathWithNamespace: gitlabResult.path_with_namespace,
      defaultBranch: 'main',
      lastCommitSha: commitSha,
    },
    status: 'draft',
    codeWorkspace: {
      status: 'not_started',
      version: 1,
      source: 'gitlab',
      setupStage: 'idle',
      setupLabel: 'Open project to set up preview',
    },
    editingMode: 'code',
  });
  await project.save();

  try {
    await createWebsiteAnalyticsConfigForProject({
      projectId: project._id,
      ownerId,
      publicSiteKey: analyticsPublicSiteKey,
      allowedOrigins: deploymentOrigins(project),
    });
  } catch (analyticsError) {
    console.warn('[clone/save] Analytics config creation failed:', analyticsError);
  }

  await ProjectAction.create({
    projectId: project._id,
    ownerId,
    type: 'clone_created',
    status: 'succeeded',
    input: { sourceUrl: job.sourceUrl, cloneJobId: jobId.toString() },
    output: { gitlabProjectId: gitlabResult.id, savedFromPreview: true },
  });

  await CloneJob.updateOne(
    { _id: jobId },
    {
      $set: {
        createdProjectId: project._id,
        currentStageLabel: 'Saved to GitLab — you can return from your dashboard',
      },
    }
  );

  await appendJobLog(jobId, 'save', `WebsiteProject created: ${project._id.toString()}`);

  return {
    project,
    created: true,
    gitlabProjectId: gitlabResult.id,
    repoUrl: gitlabResult.web_url,
  };
}
