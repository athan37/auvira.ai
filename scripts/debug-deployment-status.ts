/**
 * Debug Vercel deployment status for a project.
 * Usage: npx tsx scripts/debug-deployment-status.ts <projectId>
 */
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getLatestDeploymentStatus } from '../src/lib/vercel/getLatestDeploymentStatus';
import { checkVercelDeployment } from '../src/lib/vercel/checkDeployment';

const projectId = process.argv[2] || '6a11f1ed3d72da67984db587';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const project = await WebsiteProject.findById(projectId);
  if (!project) {
    console.error('Project not found');
    process.exit(1);
  }

  const dep = project.deployment;
  console.log('Project deployment record:', JSON.stringify(dep, null, 2));

  if (!dep?.projectId && !dep?.vercelProjectName) {
    console.log('No Vercel link on project');
    process.exit(0);
  }

  console.log('\n--- getLatestDeploymentStatus (current        projectId + projectName + since) ---');
  const combined = await getLatestDeploymentStatus({
    projectId: dep.projectId,
    projectName: dep.vercelProjectName,
    since: dep.triggeredAt,
    deployHookId: dep.deployHookId,
  });
  console.log(JSON.stringify(combined, null, 2));

  console.log('\n--- getLatestDeploymentStatus (projectId only) ---');
  const byId = await getLatestDeploymentStatus({ projectId: dep.projectId });
  console.log(JSON.stringify(byId, null, 2));

  console.log('\n--- getLatestDeploymentStatus (projectName only) ---');
  const byName = await getLatestDeploymentStatus({ projectName: dep.vercelProjectName });
  console.log(JSON.stringify(byName, null, 2));

  console.log('\n--- checkVercelDeployment ---');
  const checked = await checkVercelDeployment(dep.projectId, dep.vercelProjectName);
  console.log(JSON.stringify(checked, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
