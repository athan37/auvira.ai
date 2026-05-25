import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { checkVercelDeployment } from '@/lib/vercel/checkDeployment';
import { resolveProductionLiveUrl } from '@/lib/vercel/resolveProductionLiveUrl';
import { verifyProductionMatchesWorkspace } from '@/lib/deploy/verifyProductionMatchesWorkspace';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, stage: 'project_not_found', message: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const dep = project.deployment;
  if (!dep?.vercelProjectName && !dep?.projectId) {
    return NextResponse.json(
      {
        ok: false,
        linked: false,
        error: 'No Vercel project linked to this project.',
        message: 'Deploy to Vercel from the Save & Deploy tab to link this project.',
      },
      { status: 400 }
    );
  }

  const expectedCommitSha =
    dep.lastDeployedCommitSha || project.gitlab?.lastCommitSha || undefined;

  const status = await checkVercelDeployment(dep.projectId, dep.vercelProjectName, {
    since: dep.triggeredAt,
    deployHookId: dep.deployHookId,
    expectedCommitSha,
    deploymentId: dep.activeDeploymentId,
  });

  const commitVerified = status.commitVerified && status.status === 'ready';

  let contentVerified = false;
  let contentWarning: string | null = null;

  const liveUrl = commitVerified
    ? resolveProductionLiveUrl('ready', {
        deploymentUrl: status.deploymentUrl,
        expectedProductionUrl: dep.expectedProductionUrl,
        aliases: status.productionAliases,
      }) || status.liveUrl
    : null;

  if (commitVerified && liveUrl) {
    const verify = await verifyProductionMatchesWorkspace({
      productionUrl: liveUrl,
      projectId: params.projectId,
      gitlabProjectId: project.gitlab?.projectId,
      commitSha: expectedCommitSha,
    });
    contentVerified = verify.ok;
    if (!verify.ok) {
      contentWarning = verify.message;
    }
  }

  const resolvedProductionUrl =
    liveUrl && dep.expectedProductionUrl !== liveUrl ? liveUrl : dep.expectedProductionUrl;

  const payload = {
    ok: true,
    status: commitVerified ? 'ready' : status.status === 'ready' ? 'building' : status.status,
    liveUrl,
    deploymentUrl: status.deploymentUrl,
    inspectorUrl: status.inspectorUrl,
    message: commitVerified
      ? contentWarning || status.message
      : status.message,
    foundBy: status.foundBy,
    vercelProjectName: dep.vercelProjectName,
    expectedProductionUrl: resolvedProductionUrl || null,
    commitSha: status.commitSha || expectedCommitSha || null,
    commitShaShort: (status.commitSha || expectedCommitSha || '').slice(0, 8) || null,
    commitVerified,
    contentVerified,
    contentWarning,
  };

  await WebsiteProject.updateOne(
    { _id: project._id },
    {
      $set: {
        'deployment.status': payload.status,
        'deployment.ready': commitVerified,
        'deployment.liveUrl': liveUrl,
        'deployment.deploymentUrl': status.deploymentUrl || null,
        'deployment.inspectorUrl': status.inspectorUrl || null,
        ...(resolvedProductionUrl ? { 'deployment.expectedProductionUrl': resolvedProductionUrl } : {}),
        ...(commitVerified ? { status: 'ready' } : {}),
        ...(status.status === 'failed' ? { status: 'failed' } : {}),
      },
    }
  );

  return NextResponse.json(payload);
}
