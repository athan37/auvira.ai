/**
 * E2E: change local preview → deploy → verify production has the change.
 * Usage: npx tsx scripts/e2e-deploy-verify.ts [projectId]
 */
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { saveWorkspaceToGitLab } from '../src/lib/project-workspace/commitWorkspaceToGitLab';
import { ensureVercelProjectLinked } from '../src/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '../src/lib/vercel/triggerVercelDeployment';
import { checkVercelDeployment } from '../src/lib/vercel/checkDeployment';
import { verifyProductionMatchesWorkspace } from '../src/lib/deploy/verifyProductionMatchesWorkspace';

const projectId = process.argv[2] || '6a11f1ed3d72da67984db587';
const MARKER = `E2E-VERIFY-${Date.now().toString(36).toUpperCase()}`;
const SITE_CONFIG = 'src/lib/siteConfig.ts';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function patchSiteConfigHeadline(workspacePath: string): Promise<string> {
  const filePath = path.join(workspacePath, SITE_CONFIG);
  const content = await fs.readFile(filePath, 'utf-8');
  const match = content.match(/"headline":\s*"([^"]*)"/);
  const previous = match?.[1] || '';
  const newHeadline = `${previous.replace(/\s*—\s*E2E-VERIFY-[A-Z0-9]+$/i, '').trim()} — ${MARKER}`;
  const updated = content.replace(/"headline":\s*"[^"]*"/, `"headline": "${newHeadline}"`);
  await fs.writeFile(filePath, updated, 'utf-8');
  return newHeadline;
}

async function main() {
  console.log('=== E2E Deploy Verify ===');
  console.log('Project:', projectId);
  console.log('Marker:', MARKER);

  await mongoose.connect(process.env.MONGODB_URI!);
  const project = await WebsiteProject.findById(projectId);
  if (!project?.gitlab?.projectId) throw new Error('Project or GitLab missing');

  const workspacePath = getGitWorkspacePath(projectId);
  const newHeadline = await patchSiteConfigHeadline(workspacePath);
  console.log('\n1. Local change applied');
  console.log('   New hero headline:', newHeadline);

  const sync = await saveWorkspaceToGitLab(project, projectId, {
    force: true,
    commitMessage: `E2E deploy verify: ${MARKER}`,
  });
  console.log('\n2. GitLab sync OK');
  console.log('   commit:', sync.commitSha.slice(0, 12));
  console.log('   files:', sync.changedFiles);

  let deployment = project.deployment;
  const ensured = await ensureVercelProjectLinked(project);
  if (ensured.deployment) deployment = ensured.deployment;
  if (!deployment?.projectId) throw new Error('No Vercel project linked');

  const expectedProductionUrl =
    deployment.expectedProductionUrl ||
    (deployment.vercelProjectName
      ? `https://${deployment.vercelProjectName}.vercel.app`
      : null);

  const triggered = await triggerVercelDeployment({
    vercelProjectId: deployment.projectId,
    vercelProjectName: deployment.vercelProjectName || project.name,
    gitlabProjectId: project.gitlab.projectId,
    gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
    commitSha: sync.commitSha,
    branch: project.gitlab.defaultBranch || 'main',
  });
  console.log('\n3. Vercel deploy triggered');
  console.log('   method:', triggered.method);
  console.log('   deploymentId:', triggered.deploymentId);

  const deployedAt = new Date().toISOString();
  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        hasUnpublishedChanges: false,
        'gitlab.lastCommitSha': sync.commitSha,
        deployment: {
          ...deployment,
          status: 'building',
          lastDeployedCommitSha: sync.commitSha,
          activeDeploymentId: triggered.deploymentId,
          deployedAt,
          triggeredAt: deployedAt,
          expectedProductionUrl,
          liveUrl: null,
          deploymentUrl: null,
        },
      },
    }
  );

  console.log('\n4. Polling until commit verified on production…');
  const maxAttempts = 45;
  let lastStatus = '';

  for (let i = 1; i <= maxAttempts; i++) {
    const status = await checkVercelDeployment(deployment.projectId, deployment.vercelProjectName, {
      since: deployedAt,
      expectedCommitSha: sync.commitSha,
      deploymentId: triggered.deploymentId,
    });

    lastStatus = `${status.status} verified=${status.commitVerified}`;
    process.stdout.write(`   [${i}/${maxAttempts}] ${lastStatus}\r`);

    if (status.commitVerified && expectedProductionUrl) {
      const content = await verifyProductionMatchesWorkspace({
        productionUrl: expectedProductionUrl,
        projectId,
        gitlabProjectId: project.gitlab.projectId,
        commitSha: sync.commitSha,
      });

      const res = await fetch(expectedProductionUrl, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const html = await res.text();
      const hasMarker = html.includes(MARKER);

      console.log('\n\n=== RESULT ===');
      console.log('Production URL:', expectedProductionUrl);
      console.log('Commit verified:', status.commitVerified);
      console.log('Content marker in HTML:', hasMarker);
      console.log('Content verify:', content.ok, '-', content.message);

      if (hasMarker && status.commitVerified) {
        console.log('\nPASS: Live site includes the deployed change.');
        await mongoose.disconnect();
        process.exit(0);
      }

      console.log('\nFAIL: Deploy ready but marker not found in production HTML.');
      console.log('Headline searched:', MARKER);
      await mongoose.disconnect();
      process.exit(1);
    }

    if (status.status === 'failed') {
      console.log('\n\nFAIL: Vercel deployment failed.');
      await mongoose.disconnect();
      process.exit(1);
    }

    await sleep(5000);
  }

  console.log('\n\nFAIL: Timed out waiting for verified deploy. Last:', lastStatus);
  await mongoose.disconnect();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
