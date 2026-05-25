import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getLatestDeploymentStatus } from '../src/lib/vercel/getLatestDeploymentStatus';

const projectId = process.argv[2] || '6a11f1ed3d72da67984db587';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const p = await WebsiteProject.findById(projectId);
  if (!p?.deployment?.projectId) throw new Error('No deployment');
  const dep = p.deployment;
  console.log('Vercel project:', dep.projectId, dep.vercelProjectName);
  console.log('Expected URL:', dep.expectedProductionUrl);
  console.log('GitLab SHA:', p.gitlab?.lastCommitSha?.slice(0, 12));

  const status = await getLatestDeploymentStatus({
    projectId: dep.projectId,
    projectName: dep.vercelProjectName,
  });
  console.log(JSON.stringify(status, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
