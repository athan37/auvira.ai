import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { triggerVercelRedeploy } from '@/lib/vercel/triggerRedeploy';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

function writeFilesToDisk(files: Array<{ filePath: string; content: string }>, workspacePath: string) {
  for (const file of files) {
    const filePath = join(workspacePath, file.filePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, file.content, 'utf-8');
  }
}

/** @deprecated Legacy preview deploy path — owner deploy uses POST /api/projects/[projectId]/code-agent/deploy instead. */
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  console.warn('[DEPRECATED] /preview/deploy called — use /code-agent/deploy');
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

  const projectId = project._id;
  const spec = project.draftSiteSpec || project.siteSpec;

  try {
    // Generate files from draft spec
    const generated = generateWebsiteFiles(
      spec as unknown as import('@/lib/agent/schemas').SiteSpec,
      project.name || 'deployed-site',
      undefined
    );

    // Validate (sync check)
    const validationErrors = validateGeneratedFiles(generated.files);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Validation failed: ${validationErrors.map(e => `${e.file}: ${e.error}`).join('; ')}`,
      }, { status: 400 });
    }

    // Full build gate
    const buildResult = await validateGeneratedSite({
      files: generated.files,
      projectName: `deploy-${project._id}`,
    });
    if (!buildResult.ok) {
      return NextResponse.json({
        ok: false,
        error: `Build validation failed: ${buildResult.errors.join('; ')}`,
      }, { status: 400 });
    }

    // Write files to a deploy workspace
    const { scratchPath } = await import('@/lib/runtime/scratchDir');
    const deployWorkspacePath = scratchPath('project-deploy', params.projectId);
    if (!existsSync(deployWorkspacePath)) {
      mkdirSync(deployWorkspacePath, { recursive: true });
    }
    writeFilesToDisk(buildResult.files ?? generated.files, deployWorkspacePath);

    // Commit to GitLab
    let gitlabCommit;
    try {
      gitlabCommit = await commitFilesToGitLab({
        projectId: project.gitlab.projectId,
        branch: project.gitlab.defaultBranch || 'main',
        commitMessage: 'Deploy preview changes',
        files: generated.files,
      });
    } catch (error) {
      const errorCode = (error as any).code;
      if (errorCode === 'PROJECT_NOT_FOUND') {
        return NextResponse.json({
          ok: false,
          error: 'GitLab project not found. Please recreate the project.',
          stage: 'gitlab_project_not_found',
        }, { status: 404 });
      }
      return NextResponse.json({
        ok: false,
        error: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }, { status: 500 });
    }

    // Trigger Vercel redeploy
    let deployTriggered = false;
    let deployHookId = '';
    try {
      const redeploy = await triggerVercelRedeploy(project.gitlab.projectId);
      if (redeploy.deployTriggered) {
        deployTriggered = true;
        deployHookId = redeploy.deployHookId || '';
      }
    } catch (error) {
      console.error(`[preview/deploy] Vercel redeploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Update siteSpec to draft (publish)
    await WebsiteProject.updateOne({ _id: projectId }, {
      $set: {
        siteSpec: spec as any,
        hasUnpublishedChanges: false,
        lastPublishedAt: new Date(),
        lastEditedAt: new Date(),
        'gitlab.lastCommitSha': (gitlabCommit as any).id,
      },
    });

    // Record action
    await ProjectAction.create({
      projectId,
      ownerId: project.ownerId,
      type: 'deploy_preview_changes',
      status: 'succeeded',
      input: { commitSha: (gitlabCommit as any).id },
      output: {
        commitSha: (gitlabCommit as any).id,
        deployTriggered,
        deployHookId,
      },
      commitSha: (gitlabCommit as any).id,
      deploymentId: deployHookId,
      completedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      deployment: {
        provider: 'vercel',
        deployTriggered,
        deployHookId,
        liveUrl: project.deployment?.liveUrl || null,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}