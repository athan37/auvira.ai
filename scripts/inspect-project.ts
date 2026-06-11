import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { ProjectEditJob } from '../src/models/ProjectEditJob';
import { ProjectAction } from '../src/models/ProjectAction';

const id = process.argv[2];
if (!id) {
  console.error('Usage: npx tsx --env-file=.env scripts/inspect-project.ts <projectId>');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const p = await WebsiteProject.findById(id).lean();
  if (!p) {
    console.log('Project not found');
    return;
  }
  console.log('name:', p.name);
  console.log('status:', p.status);
  console.log('gitlab:', p.gitlab?.repoUrl, 'branch:', p.gitlab?.defaultBranch);
  console.log('codeWorkspace:', JSON.stringify(p.codeWorkspace, null, 2));
  console.log('deployment:', JSON.stringify(p.deployment, null, 2));

  const jobs = await ProjectEditJob.find({ projectId: id }).sort({ createdAt: -1 }).limit(3).lean();
  for (const j of jobs) {
    console.log('\n--- job', j._id, j.status, j.createdAt);
    for (const l of (j.logs || []).filter((x) =>
      /fail|build|deploy|validation/i.test(`${x.message || ''}${x.stage || ''}`)
    )) {
      console.log(`  [${l.stage}] ${(l.message || '').slice(0, 400)}`);
      if (l.data && typeof l.data === 'object' && 'buildLog' in l.data) {
        console.log('  buildLog:', String((l.data as { buildLog?: string }).buildLog).slice(-2000));
      }
    }
  }

  const actions = await ProjectAction.find({ projectId: id, type: 'vercel_deploy' })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  console.log('\ndeploy actions:', JSON.stringify(actions, null, 2));
}

main()
  .then(() => mongoose.disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
