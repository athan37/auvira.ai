/**
 * Repair build blockers, sync to GitLab, and trigger a Vercel production deploy.
 *
 * Usage: npx tsx --env-file=.env scripts/redeploy-project.ts [projectId]
 */
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { ensureGitWorkspace } from '../src/lib/project-workspace/gitWorkspaceManager';
import { repairSiteConfigTypesInWorkspace } from '../src/lib/preview/repairSiteConfigTypes';
import { saveWorkspaceToGitLab } from '../src/lib/project-workspace/commitWorkspaceToGitLab';
import { ensureVercelProjectLinked } from '../src/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '../src/lib/vercel/triggerVercelDeployment';
import { checkVercelDeployment } from '../src/lib/vercel/checkDeployment';
import { generateWebsiteAnalyticsSource } from '../src/lib/analytics/generated-sites/analyticsSourceTemplates';

const projectId = process.argv[2] || '6a135ba264e7672599597ea1';
const COMMIT_MESSAGE =
  'Fix build: add SiteSectionPresentation type and WebsiteAnalytics ES5-safe flush';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  let project = await WebsiteProject.findById(projectId);
  if (!project?.gitlab?.projectId) {
    throw new Error(`Project or GitLab link not found: ${projectId}`);
  }

  if (!project.codeWorkspace || project.codeWorkspace.status !== 'ready') {
    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          'codeWorkspace.status': 'ready',
          'codeWorkspace.source': 'gitlab',
        },
      }
    );
    project = await WebsiteProject.findById(projectId);
    if (!project) throw new Error('Project reload failed');
  }

  console.log('=== Redeploy ===');
  console.log('Project:', project.name);

  const workspace = await ensureGitWorkspace(project);
  console.log('Workspace:', workspace.workspacePath, '@', workspace.headSha.slice(0, 8));

  const repairedTypes = await repairSiteConfigTypesInWorkspace(workspace.workspacePath);
  const analyticsPath = path.join(
    workspace.workspacePath,
    'src/components/analytics/WebsiteAnalytics.tsx'
  );
  await fs.writeFile(analyticsPath, generateWebsiteAnalyticsSource(), 'utf-8');
  console.log('Local repairs:', { siteConfigTypes: repairedTypes, analytics: true });

  const sync = await saveWorkspaceToGitLab(project, projectId, {
    force: true,
    commitMessage: COMMIT_MESSAGE,
  });
  console.log('GitLab sync:', sync);

  const ensured = await ensureVercelProjectLinked(project);
  const deployment = ensured.deployment ?? project.deployment;
  if (!deployment?.projectId) {
    throw new Error('No Vercel project linked');
  }

  const triggered = await triggerVercelDeployment({
    vercelProjectId: deployment.projectId,
    vercelProjectName: deployment.vercelProjectName || project.name,
    gitlabProjectId: project.gitlab.projectId,
    gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
    commitSha: sync.commitSha,
    branch: project.gitlab.defaultBranch || 'main',
  });
  console.log('Vercel trigger:', triggered);

  const deployedAt = new Date().toISOString();
  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        hasUnpublishedChanges: false,
        lastPublishedAt: new Date(),
        'gitlab.lastCommitSha': sync.commitSha,
        deployment: {
          ...deployment,
          status: 'building',
          deployTriggered: true,
          lastDeployedCommitSha: sync.commitSha,
          activeDeploymentId: triggered.deploymentId,
          deployedAt,
          triggeredAt: deployedAt,
        },
        status: 'building',
      },
    }
  );

  console.log('Polling Vercel (up to ~4 min)...');
  for (let attempt = 1; attempt <= 48; attempt++) {
    const status = await checkVercelDeployment(
      deployment.projectId,
      deployment.vercelProjectName,
      {
        since: deployedAt,
        expectedCommitSha: sync.commitSha,
        deploymentId: triggered.deploymentId,
      }
    );

    process.stdout.write(
      `  [${attempt}/48] ${status.status} commitVerified=${status.commitVerified} ${status.inspectorUrl ?? ''}\r`
    );

    if (status.status === 'failed') {
      console.log('\n\nDeploy FAILED.');
      console.log('Inspector:', status.inspectorUrl);
      await mongoose.disconnect();
      process.exit(1);
    }

    if (status.status === 'ready' && status.commitVerified) {
      console.log('\n\nDeploy READY.');
      console.log('Live URL:', status.liveUrl || deployment.expectedProductionUrl);
      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            status: 'ready',
            liveUrl: status.liveUrl || deployment.expectedProductionUrl,
            'deployment.status': 'ready',
            'deployment.liveUrl': status.liveUrl || deployment.expectedProductionUrl,
            'deployment.deploymentUrl': status.deploymentUrl,
            'deployment.inspectorUrl': status.inspectorUrl,
          },
        }
      );
      await mongoose.disconnect();
      return;
    }

    await sleep(5000);
  }

  console.log('\n\nDeploy poll timed out — check Vercel dashboard.');
  await mongoose.disconnect();
  process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
