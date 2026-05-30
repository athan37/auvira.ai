/**
 * Inspect Vercel deployment status and build logs for a WebsiteProject.
 * Usage: npx tsx --env-file=.env scripts/inspect-vercel-build.ts [projectId]
 */
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { getLatestDeploymentStatus } from '../src/lib/vercel/getLatestDeploymentStatus';
import { VercelClient } from '../src/lib/vercel/vercelClient';

const projectId = process.argv[2] || '6a135ba264e7672599597ea1';

async function fetchBuildLog(deploymentId: string): Promise<string[]> {
  const client = new VercelClient();
  const events = await client.request<{
    events?: Array<{ type: string; payload?: { text?: string }; created?: number }>;
  }>(`/v3/deployments/${deploymentId}/events?limit=200&direction=backward`, {
    method: 'GET',
  });

  return (events.events || [])
    .map((e) => e.payload?.text?.trim())
    .filter((line): line is string => Boolean(line))
    .reverse();
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const project = await WebsiteProject.findById(projectId).lean();
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  console.log('=== Project ===');
  console.log('name:', project.name);
  console.log('status:', project.status);
  console.log('deployment.status:', project.deployment?.status);
  console.log('vercelProjectId:', project.deployment?.projectId);
  console.log('vercelProjectName:', project.deployment?.vercelProjectName);
  console.log('gitlab:', project.gitlab?.pathWithNamespace);
  console.log('lastCommit:', project.gitlab?.lastCommitSha);
  console.log('deployment.error:', project.deployment?.error);
  if (project.generatedSiteValidation) {
    console.log('generatedSiteValidation.ok:', project.generatedSiteValidation.ok);
    console.log('generatedSiteValidation.errors:', project.generatedSiteValidation.errors?.slice(0, 5));
  }

  const dep = project.deployment;
  if (!dep?.projectId && !dep?.vercelProjectName) {
    console.log('\nNo Vercel project linked.');
    await mongoose.disconnect();
    return;
  }

  const status = await getLatestDeploymentStatus({
    projectId: dep.projectId,
    projectName: dep.vercelProjectName,
  });

  console.log('\n=== Latest Vercel deployment ===');
  console.log(JSON.stringify(status, null, 2));

  if (!status.deploymentId) {
    await mongoose.disconnect();
    return;
  }

  try {
    const lines = await fetchBuildLog(status.deploymentId);
    const errorLines = lines.filter((l) =>
      /error|failed|ERR!|Type error|Cannot find|Module not found|Build failed/i.test(l)
    );

    console.log('\n=== Build errors ===');
    if (errorLines.length > 0) {
      console.log(errorLines.slice(-40).join('\n'));
    } else {
      console.log('(no obvious error lines — showing log tail)');
      console.log(lines.slice(-50).join('\n'));
    }
  } catch (error) {
    console.error('\nFailed to fetch build events:', error instanceof Error ? error.message : error);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
