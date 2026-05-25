/**
 * Sync local workspace to GitLab and trigger Vercel deploy (pinned to commit SHA).
 * Usage: npx tsx scripts/sync-and-deploy.ts <projectId>
 */
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { saveWorkspaceToGitLab } from '../src/lib/project-workspace/commitWorkspaceToGitLab';
import { ensureVercelProjectLinked } from '../src/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '../src/lib/vercel/triggerVercelDeployment';

const projectId = process.argv[2] || '6a11f1ed3d72da67984db587';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const project = await WebsiteProject.findById(projectId);
  if (!project) throw new Error('Project not found');
  if (!project.gitlab?.projectId) throw new Error('No GitLab project');

  const sync = await saveWorkspaceToGitLab(project, projectId, {
    force: true,
    commitMessage: 'Deploy: sync preview to GitLab',
  });
  console.log('Sync:', sync);

  let deployment = project.deployment;
  const ensured = await ensureVercelProjectLinked(project);
  if (ensured.deployment) deployment = ensured.deployment;

  if (!deployment?.projectId) throw new Error('No Vercel project');

  const redeploy = await triggerVercelDeployment({
    vercelProjectId: deployment.projectId,
    vercelProjectName: deployment.vercelProjectName || project.name,
    gitlabProjectId: project.gitlab.projectId,
    gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
    commitSha: sync.commitSha,
    branch: project.gitlab.defaultBranch || 'main',
  });
  console.log('Deploy:', redeploy);

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
          triggeredAt: new Date().toISOString(),
          liveUrl: null,
        },
        status: 'building',
      },
    }
  );

  console.log('Done — Vercel build started from commit', sync.commitSha.slice(0, 8));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
