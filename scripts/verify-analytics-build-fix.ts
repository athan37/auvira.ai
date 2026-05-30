/**
 * Patch customer repo WebsiteAnalytics.tsx with fixed template and run npm run build.
 * Usage: npx tsx --env-file=.env scripts/verify-analytics-build-fix.ts [projectId]
 */
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { ensureGitWorkspace } from '../src/lib/project-workspace/gitWorkspaceManager';
import { generateWebsiteAnalyticsSource } from '../src/lib/analytics/generated-sites/analyticsSourceTemplates';

const projectId = process.argv[2] || '6a135ba264e7672599597ea1';
const ANALYTICS_PATH = 'src/components/analytics/WebsiteAnalytics.tsx';

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const project = await WebsiteProject.findById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const workspace = await ensureGitWorkspace(project);
  const target = `${workspace.workspacePath}/${ANALYTICS_PATH}`;

  await fs.writeFile(target, generateWebsiteAnalyticsSource(), 'utf-8');
  console.log('Patched', target);
  console.log('Running npm run build in customer repo...');

  execSync('npm run build', {
    cwd: workspace.workspacePath,
    stdio: 'inherit',
    timeout: 180_000,
  });

  console.log('BUILD OK');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
