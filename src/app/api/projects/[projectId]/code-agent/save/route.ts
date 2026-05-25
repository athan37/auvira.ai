import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { ProjectEditJob } from '@/models/ProjectEditJob';
import { appendEditJobLog } from '@/lib/project-workspace/editJobLogger';
import { saveWorkspaceToGitLab } from '@/lib/project-workspace/commitWorkspaceToGitLab';

export const runtime = 'nodejs';

/**
 * Save route — syncs local preview to GitLab (incremental when possible, full sync if needed).
 * Pass `{ "force": true }` to always push the full workspace (legacy force-sync behavior).
 */
export async function POST(
  request: NextRequest,
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

  let force = false;
  let commitMessage: string | undefined;
  try {
    const body = await request.json();
    if (body?.force === true) force = true;
    if (body?.commitMessage && typeof body.commitMessage === 'string') {
      commitMessage = body.commitMessage;
    }
  } catch {
    /* empty body is fine */
  }

  const projectId = params.projectId;
  const source = project.codeWorkspace?.source || 'generated';

  const latestReadyJob = await ProjectEditJob.findOne({
    projectId,
    status: 'ready',
  }).sort({ createdAt: -1 });

  const editJobId = latestReadyJob?._id.toString();

  if (editJobId) {
    await appendEditJobLog(editJobId, 'save_started', 'Save to GitLab started', { force });
  }

  try {
    const { commitSha, pushed, changedFiles, mode } = await saveWorkspaceToGitLab(
      project,
      projectId,
      { force, commitMessage }
    );
    console.log(
      `[code-agent/save] source=gitlab mode=${mode} api_commit=${commitSha} files=${changedFiles}`
    );

    if (editJobId) {
      await appendEditJobLog(editJobId, 'save_succeeded', 'Saved to GitLab', {
        commitSha,
        pushed,
        mode,
      });
    }

    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          hasUnpublishedChanges: false,
          lastPublishedAt: new Date(),
          lastEditedAt: new Date(),
          'gitlab.lastCommitSha': commitSha,
        },
      }
    );

    try {
      await ProjectAction.create({
        projectId,
        ownerId: project.ownerId,
        type: force ? 'force_sync_workspace_to_gitlab' : 'save_code_workspace_changes',
        status: 'succeeded',
        input: { source, force, mode },
        output: { commitSha, pushed, changedFiles, mode },
        commitSha,
        completedAt: new Date(),
      });
    } catch (logError) {
      console.warn('[code-agent/save] ProjectAction log failed:', logError);
    }

    return NextResponse.json({
      ok: true,
      git: { commitSha, pushed, changedFiles, mode, force: mode === 'force' },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[code-agent/save] Save failed: ${errMsg}`);

    if (editJobId) {
      await appendEditJobLog(editJobId, 'save_failed', errMsg);
    }

    try {
      await ProjectAction.create({
        projectId,
        ownerId: project.ownerId,
        type: 'save_code_workspace_changes',
        status: 'failed',
        input: { source, force },
        output: { error: errMsg },
        completedAt: new Date(),
      });
    } catch (logError) {
      console.warn('[code-agent/save] ProjectAction failure log failed:', logError);
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
