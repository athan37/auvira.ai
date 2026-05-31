import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { ProjectEditJob } from '@/models/ProjectEditJob';
import { appendEditJobLog } from '@/lib/project-workspace/editJobLogger';
import { saveWorkspaceToGitLab } from '@/lib/project-workspace/commitWorkspaceToGitLab';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { validateWorkspace } from '@/lib/project-workspace/validateWorkspace';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';
import { validateSandboxWorkspace } from '@/lib/sandbox/validateSandboxWorkspace';
import { ensureVercelProjectLinked } from '@/lib/vercel/ensureVercelProject';
import { triggerVercelDeployment } from '@/lib/vercel/triggerVercelDeployment';
import { hasVercelApiToken } from '@/lib/vercel/vercelEnv';

export const runtime = 'nodejs';

/**
 * Deploy route — sync local preview to GitLab (if dirty), link Vercel if needed,
 * then trigger a Vercel deployment from the latest GitLab code.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (!project.gitlab?.projectId) {
    return NextResponse.json(
      { ok: false, error: 'No GitLab project linked to this project.' },
      { status: 400 }
    );
  }

  if (!project.codeWorkspace || project.codeWorkspace.status !== 'ready') {
    return NextResponse.json(
      { ok: false, error: 'Code workspace not ready.' },
      { status: 400 }
    );
  }

  if (project.codeWorkspace.lastValidationStatus === 'failed') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Latest preview validation failed. Fix the workspace or run another edit before deploying.',
      },
      { status: 400 }
    );
  }

  if (!hasVercelApiToken()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'SITE_AGENT_VERCEL_TOKEN is not configured (optional — only needed to publish customer sites to Vercel).',
      },
      { status: 503 }
    );
  }

  const projectId = params.projectId;

  const latestReadyJob = await ProjectEditJob.findOne({
    projectId,
    status: 'ready',
  }).sort({ createdAt: -1 });

  const editJobId = latestReadyJob?._id.toString();

  if (editJobId) {
    await appendEditJobLog(editJobId, 'deploy_started', 'Deploy started (sync + Vercel)');
  }

  try {
    const preDeployValidation = isSandboxPreviewEnabled()
      ? await validateSandboxWorkspace(projectId)
      : await validateWorkspace(getGitWorkspacePath(projectId), { forceFullBuild: true });

    if (!preDeployValidation.ok) {
      const detail =
        preDeployValidation.errors[0] ||
        'Workspace build check failed before deploy.';
      if (editJobId) {
        await appendEditJobLog(editJobId, 'deploy_failed', detail);
      }
      return NextResponse.json({ ok: false, error: detail }, { status: 400 });
    }

    const syncResult = await saveWorkspaceToGitLab(project, projectId, {
      force: true,
      commitMessage:
        project.codeWorkspace.lastEditSummary || 'Deploy: sync preview to GitLab',
    });
    const sync = { synced: true, ...syncResult };

    console.log(
      `[code-agent/deploy] Synced ${sync.changedFiles} file(s) to GitLab (${sync.mode}): ${sync.commitSha}`
    );
    if (editJobId) {
      await appendEditJobLog(editJobId, 'save_succeeded', 'Force-synced to GitLab before deploy', {
        commitSha: sync.commitSha,
        changedFiles: sync.changedFiles,
      });
    }

    let deployment = project.deployment;
    let vercelLinked = false;

    try {
      const ensured = await ensureVercelProjectLinked(project);
      if (ensured.deployment) {
        deployment = ensured.deployment;
        vercelLinked = ensured.created;
        if (vercelLinked) {
          console.log(
            `[code-agent/deploy] Vercel project linked: ${deployment.projectId} (${deployment.vercelProjectName})`
          );
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[code-agent/deploy] Vercel auto-link failed: ${errMsg}`);
      throw new Error(`Failed to link Vercel project: ${errMsg}`);
    }

    if (!deployment?.projectId) {
      throw new Error('Could not link a Vercel project for this GitLab repository.');
    }

    const redeploy = await triggerVercelDeployment({
      vercelProjectId: deployment.projectId,
      vercelProjectName: deployment.vercelProjectName || project.name,
      gitlabProjectId: project.gitlab.projectId,
      gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
      commitSha: sync.commitSha,
      branch: project.gitlab.defaultBranch || 'main',
    });

    if (!redeploy.deployTriggered) {
      throw new Error(redeploy.error || 'Failed to trigger Vercel deployment.');
    }

    const deployTriggered = true;
    const deployHookId = redeploy.deployHookId || deployment.deployHookId || '';
    const activeDeploymentId = redeploy.deploymentId || '';
    const deployedAt = new Date().toISOString();

    if (editJobId) {
      await appendEditJobLog(editJobId, 'deploy_succeeded', 'Vercel deploy triggered', {
        deployTriggered,
        vercelProjectId: deployment.projectId,
        commitSha: sync.commitSha,
        deployMethod: redeploy.method,
        deploymentId: activeDeploymentId,
      });
    }

    const expectedProductionUrl =
      deployment.expectedProductionUrl ||
      (deployment.vercelProjectName
        ? `https://${deployment.vercelProjectName}.vercel.app`
        : null);

    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          ...(sync.synced
            ? {
                hasUnpublishedChanges: false,
                lastPublishedAt: new Date(),
                'gitlab.lastCommitSha': sync.commitSha,
              }
            : {}),
          deployment: {
            ...deployment,
            status: 'building',
            deployTriggered: true,
            triggeredAt: deployedAt,
            deployedAt,
            liveUrl: null,
            deploymentUrl: null,
            inspectorUrl: null,
            expectedProductionUrl,
            lastDeployedCommitSha: sync.commitSha,
            activeDeploymentId,
            ...(deployHookId ? { deployHookId } : {}),
          },
          status: 'building',
        },
      }
    );

    try {
      await ProjectAction.create({
        projectId,
        ownerId: project.ownerId,
        type: 'vercel_deploy',
        status: 'succeeded',
        input: {
          gitlabProjectId: project.gitlab.projectId,
          vercelLinked,
          synced: sync.synced,
        },
        output: {
          deployTriggered,
          deployHookId,
          deployMethod: redeploy.method,
          vercelProjectId: deployment.projectId,
          vercelProjectName: deployment.vercelProjectName,
          commitSha: sync.commitSha,
          changedFiles: sync.changedFiles,
          syncMode: sync.mode,
        },
        commitSha: sync.commitSha,
        deploymentId: activeDeploymentId || deployHookId,
        completedAt: new Date(),
      });
    } catch (logError) {
      console.warn('[code-agent/deploy] ProjectAction log failed:', logError);
    }

    return NextResponse.json({
      ok: true,
      git: {
        synced: sync.synced,
        commitSha: sync.commitSha,
        changedFiles: sync.changedFiles,
        mode: sync.mode,
      },
      deployment: {
        provider: 'vercel',
        status: 'building',
        deployTriggered,
        deployHookId,
        deploymentId: activeDeploymentId,
        vercelLinked,
        projectId: deployment.projectId,
        vercelProjectName: deployment.vercelProjectName,
        expectedProductionUrl,
        commitSha: sync.commitSha,
        commitShaShort: sync.commitSha.slice(0, 8),
        liveUrl: null,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[code-agent/deploy] Deploy failed: ${errMsg}`);

    if (editJobId) {
      await appendEditJobLog(editJobId, 'deploy_failed', errMsg);
    }

    try {
      await ProjectAction.create({
        projectId,
        ownerId: project.ownerId,
        type: 'vercel_deploy',
        status: 'failed',
        input: { gitlabProjectId: project.gitlab.projectId },
        output: { error: errMsg },
        completedAt: new Date(),
      });
    } catch (logError) {
      console.warn('[code-agent/deploy] ProjectAction failure log failed:', logError);
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
