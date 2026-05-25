import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { saveWorkspaceToGitLab } from '@/lib/project-workspace/commitWorkspaceToGitLab';

export const runtime = 'nodejs';

/**
 * @deprecated Prefer POST /code-agent/save (auto-upgrades to full sync when needed).
 * This route always performs a full workspace sync (`force: true`).
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

  let commitMessage = 'Save preview to GitLab';
  try {
    const body = await request.json();
    if (body?.commitMessage && typeof body.commitMessage === 'string') {
      commitMessage = body.commitMessage;
    }
  } catch {
    /* empty body is fine */
  }

  const projectId = params.projectId;

  try {
    const result = await saveWorkspaceToGitLab(project, projectId, {
      force: true,
      commitMessage,
    });

    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          hasUnpublishedChanges: false,
          lastPublishedAt: new Date(),
          lastEditedAt: new Date(),
          'gitlab.lastCommitSha': result.commitSha,
        },
      }
    );

    try {
      await ProjectAction.create({
        projectId,
        ownerId: project.ownerId,
        type: 'force_sync_workspace_to_gitlab',
        status: 'succeeded',
        input: { commitMessage },
        output: {
          commitSha: result.commitSha,
          changedFiles: result.changedFiles,
          mode: result.mode,
        },
        commitSha: result.commitSha,
        completedAt: new Date(),
      });
    } catch (logError) {
      console.warn('[code-agent/force-sync] ProjectAction log failed:', logError);
    }

    return NextResponse.json({
      ok: true,
      git: {
        commitSha: result.commitSha,
        changedFiles: result.changedFiles,
        mode: result.mode,
        force: true,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
