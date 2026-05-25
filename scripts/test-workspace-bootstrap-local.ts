/**
 * Local bootstrap smoke test for a project id.
 * Usage: SITE_AGENT_DEV_BYPASS_AUTH=1 node --env-file=.env npx tsx scripts/test-workspace-bootstrap-local.ts <projectId>
 */
import { connectMongoDB } from '../src/lib/mongodb';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { bootstrapProjectPreview } from '../src/lib/project-workspace/bootstrapProjectPreview';
import { checkPreviewHealthy } from '../src/lib/project-workspace/bootstrapProjectPreview';

const projectId = process.argv[2] || '6a135ba264e7672599597ea1';

async function main() {
  if (process.env.SITE_AGENT_DEV_BYPASS_AUTH !== '1') {
    console.error('Set SITE_AGENT_DEV_BYPASS_AUTH=1');
    process.exit(1);
  }

  await connectMongoDB();
  const project = await WebsiteProject.findById(projectId);
  if (!project) {
    console.error('Project not found:', projectId);
    process.exit(1);
  }

  console.log('[bootstrap-test] starting for', project.name, projectId);
  const t0 = Date.now();

  try {
    await bootstrapProjectPreview(project, '507f1f77bcf86cd799439011');
    const updated = await WebsiteProject.findById(projectId);
    const port = updated?.preview?.port;
    console.log('[bootstrap-test] done in', Math.round((Date.now() - t0) / 1000), 's');
    console.log('[bootstrap-test] preview:', {
      status: updated?.preview?.status,
      port,
      previewMode: (updated?.preview as { previewMode?: string })?.previewMode,
      url: updated?.preview?.url,
    });
    if (port) {
      const healthy = await checkPreviewHealthy(port);
      console.log('[bootstrap-test] health', port, healthy ? 'OK' : 'FAIL');
    }
  } catch (err) {
    console.error('[bootstrap-test] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
