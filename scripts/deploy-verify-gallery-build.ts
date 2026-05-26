/**
 * Repair siteConfig gallery types → sync GitLab → trigger Vercel → poll until build passes/fails.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/deploy-verify-gallery-build.ts [projectId]
 */
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { saveWorkspaceToGitLab } from '../src/lib/project-workspace/commitWorkspaceToGitLab';
import { repairSiteConfigTypesInWorkspace } from '../src/lib/preview/repairSiteConfigTypes';
import {
  siteConfigNeedsGalleryTypeUpgrade,
  siteConfigDataUsesGallery,
} from '../src/lib/builder/siteConfigTypes';
import { ensureVercelProjectLinked } from '../src/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '../src/lib/vercel/triggerVercelDeployment';
import { checkVercelDeployment } from '../src/lib/vercel/checkDeployment';

const projectId = process.argv[2] || '6a135ba264e7672599597ea1';
const SITE_CONFIG = 'src/lib/siteConfig.ts';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Deploy verify: gallery SiteSection types ===');
  console.log('Project:', projectId);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required (use --env-file=.env)');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const project = await WebsiteProject.findById(projectId);
  if (!project?.gitlab?.projectId) {
    throw new Error('Project or GitLab link not found');
  }

  let workspacePath: string;
  try {
    workspacePath = getGitWorkspacePath(projectId);
    await fs.access(path.join(workspacePath, 'package.json'));
  } catch {
    throw new Error(
      `Git workspace missing at ${getGitWorkspacePath(projectId)}. Open the project in the editor first to bootstrap the workspace.`
    );
  }

  const configPath = path.join(workspacePath, SITE_CONFIG);
  const before = await fs.readFile(configPath, 'utf-8');
  console.log('\n1. siteConfig.ts before repair');
  console.log('   uses gallery data:', siteConfigDataUsesGallery(before));
  console.log('   needs type upgrade:', siteConfigNeedsGalleryTypeUpgrade(before));

  const repaired = await repairSiteConfigTypesInWorkspace(workspacePath);
  const after = await fs.readFile(configPath, 'utf-8');
  console.log('\n2. Repair');
  console.log('   repaired:', repaired);
  console.log('   needs upgrade after:', siteConfigNeedsGalleryTypeUpgrade(after));
  console.log('   union has gallery:', /\bgallery\b/.test(after.split('export const siteConfig')[0] || ''));

  if (siteConfigNeedsGalleryTypeUpgrade(after)) {
    throw new Error('siteConfig.ts still missing gallery in SiteSection union after repair');
  }

  console.log('\n3. Sync to GitLab (includes repair on commit path)...');
  const sync = await saveWorkspaceToGitLab(project, projectId, {
    force: true,
    commitMessage: 'Fix siteConfig SiteSection types for gallery sections (build gate)',
  });
  console.log('   commit:', sync.commitSha);
  console.log('   changed files:', sync.changedFiles);

  let deployment = project.deployment;
  const ensured = await ensureVercelProjectLinked(project);
  if (ensured.deployment) deployment = ensured.deployment;
  if (!deployment?.projectId) throw new Error('No Vercel project linked');

  const expectedProductionUrl =
    deployment.expectedProductionUrl ||
    (deployment.vercelProjectName
      ? `https://${deployment.vercelProjectName}.vercel.app`
      : null);

  console.log('\n4. Trigger Vercel deployment...');
  const triggered = await triggerVercelDeployment({
    vercelProjectId: deployment.projectId,
    vercelProjectName: deployment.vercelProjectName || project.name,
    gitlabProjectId: project.gitlab.projectId,
    gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
    commitSha: sync.commitSha,
    branch: project.gitlab.defaultBranch || 'main',
  });
  console.log('   method:', triggered.method);
  console.log('   deploymentId:', triggered.deploymentId);
  console.log('   production URL:', expectedProductionUrl);

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
          expectedProductionUrl,
        },
        status: 'building',
      },
    }
  );

  console.log('\n5. Polling Vercel build (up to ~4 min)...');
  const maxAttempts = 48;
  let last = '';

  for (let i = 1; i <= maxAttempts; i++) {
    const status = await checkVercelDeployment(
      deployment.projectId,
      deployment.vercelProjectName,
      {
        since: deployedAt,
        expectedCommitSha: sync.commitSha,
        deploymentId: triggered.deploymentId,
      }
    );

    last = JSON.stringify({
      status: status.status,
      commitVerified: status.commitVerified,
      error: status.error?.slice?.(0, 200),
    });
    process.stdout.write(`   [${i}/${maxAttempts}] ${last}\r`);

    if (status.status === 'failed') {
      console.log('\n\nFAIL: Vercel build failed.');
      if (status.buildLog) {
        console.log('\n--- build log (tail) ---');
        console.log(status.buildLog.slice(-3000));
      }
      await mongoose.disconnect();
      process.exit(1);
    }

    if (status.commitVerified) {
      console.log('\n\nPASS: Vercel deployment succeeded with expected commit.');
      console.log('Production:', expectedProductionUrl);
      await mongoose.disconnect();
      process.exit(0);
    }

    await sleep(5000);
  }

  console.log('\n\nTIMEOUT: last status', last);
  await mongoose.disconnect();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
