import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { ProjectMessage } from '@/models/ProjectMessage';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { getLLMClient } from '@/lib/llm/llmClient';
import { editResultSchema, type SiteSpec, type DesignBrief } from '@/lib/agent/schemas';
import { buildApplyEditPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { triggerVercelRedeploy } from '@/lib/vercel/triggerRedeploy';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

function logStage(stage: string, duration_ms?: number): StageLog {
  const entry: StageLog = {
    stage,
    timestamp: new Date().toISOString(),
  };
  if (duration_ms !== undefined) {
    entry.duration_ms = duration_ms;
  }
  console.log(`[PROJECTS/CHAT] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  return entry;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  console.warn('[DEPRECATED] /projects/[id]/chat called — use /code-agent/edit/stream');
  const startTime = Date.now();
  const stageLogs: StageLog[] = [];

  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, stage: 'project_not_found', message: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (!project.gitlab?.projectId) {
    return NextResponse.json(
      { ok: false, error: 'No GitLab project linked to this project.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 });
    }

    // Save user message
    const userMsg = new ProjectMessage({
      projectId: project._id,
      ownerId: project.ownerId,
      role: 'user',
      content: message,
    });
    await userMsg.save();

    const llmClient = getLLMClient();

    stageLogs.push(logStage('llm_edit_start'));

    let editResult;
    try {
      editResult = await llmClient.generateJSON<{ updatedSiteSpec: SiteSpec; summaryOfChanges: string[] }>({
        system: "You are an AI website maintenance agent. Update the existing site spec according to the user's requested edit. Preserve the business identity and existing structure unless the user asks to change it. Return only JSON matching the schema.",
        prompt: buildApplyEditPrompt(message, project.siteSpec as Record<string, unknown>),
        schema: editResultSchema,
      });
    } catch (error) {
      stageLogs.push(logStage('llm_edit_failed'));
      await ProjectMessage.create({
        projectId: project._id,
        ownerId: project.ownerId,
        role: 'assistant',
        content: `Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { stage: 'llm_edit_failed', stageLogs },
      });
      return NextResponse.json({
        ok: false,
        error: `LLM edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'edit_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }
    stageLogs.push(logStage('llm_edit_done', Date.now() - startTime));

    const { updatedSiteSpec, summaryOfChanges } = editResult.data;

    stageLogs.push(logStage('design_brief_start'));

    let designBrief: DesignBrief;
    try {
      const businessProfileForDesign = {
        businessName: project.siteSpec.siteTitle.split(' - ')[0] || project.siteSpec.siteTitle,
        industry: 'general-service',
        description: project.siteSpec.sections.find((s: { type: string }) => s.type === 'about')?.body || '',
        services: project.siteSpec.sections.find((s: { type: string }) => s.type === 'services')?.items || [],
        location: '',
        phone: '',
        email: '',
        brandTone: project.siteSpec.designDirection?.tone || '',
        targetCustomers: [],
      };
      designBrief = await generateDesignBriefAgent(
        businessProfileForDesign,
        updatedSiteSpec as unknown as Record<string, unknown>,
        project.sourceUrl || 'https://example.com'
      );
    } catch (error) {
      stageLogs.push(logStage('design_brief_failed'));
      designBrief = getDefaultDesignBrief();
      console.error(`[PROJECTS/CHAT] Design brief regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('design_brief_done', Date.now() - startTime));

    stageLogs.push(logStage('build_files_start'));

    let generated;
    try {
      generated = generateWebsiteFiles(updatedSiteSpec, 'updated-site', designBrief);
    } catch (error) {
      stageLogs.push(logStage('build_files_failed'));
      const errMsg = `File generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await ProjectMessage.create({
        projectId: project._id,
        ownerId: project.ownerId,
        role: 'assistant',
        content: errMsg,
        metadata: { stage: 'build_files_failed', stageLogs },
      });
      return NextResponse.json({
        ok: false,
        error: errMsg,
        stage: 'build_files_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        updatedSiteSpec,
        summaryOfChanges,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_files_done', Date.now() - startTime));

    stageLogs.push(logStage('validate_files_start'));

    const validationErrors = validateGeneratedFiles(updatedSiteSpec, 'updated-site');
    if (validationErrors.length > 0) {
      stageLogs.push(logStage('validate_files_failed'));
      const errorList = validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
      await ProjectMessage.create({
        projectId: project._id,
        ownerId: project.ownerId,
        role: 'assistant',
        content: `Validation failed: ${errorList}`,
        metadata: { stage: 'validate_files_failed', stageLogs },
      });
      return NextResponse.json({
        ok: false,
        error: `Generated file validation failed: ${errorList}`,
        stage: 'validate_files_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        validationErrors,
      }, { status: 500 });
    }
    stageLogs.push(logStage('validate_files_done', Date.now() - startTime));

    let buildValidation: { ok: boolean; tempDir: string; logs: string; errors: string[]; durationMs: number } | null = null;

    stageLogs.push(logStage('build_gate_start'));

    const buildResult = await validateGeneratedSite({
      files: generated.files,
      projectName: `edit-${project._id}`,
    });

    buildValidation = {
      ok: buildResult.ok,
      tempDir: buildResult.tempDir,
      logs: buildResult.logs,
      errors: buildResult.errors,
      durationMs: buildResult.durationMs,
    };

    if (!buildResult.ok) {
      stageLogs.push(logStage('build_gate_failed'));
      await ProjectMessage.create({
        projectId: project._id,
        ownerId: project.ownerId,
        role: 'assistant',
        content: `Build validation failed: ${buildResult.errors.join('; ')}`,
        metadata: { stage: 'build_gate_failed', stageLogs },
      });
      return NextResponse.json({
        ok: false,
        error: `Generated site build validation failed: ${buildResult.errors.join('; ')}`,
        stage: 'generated_site_validation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        updatedSiteSpec,
        summaryOfChanges,
        generatedSiteValidation: buildValidation,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_gate_done', Date.now() - startTime));

    stageLogs.push(logStage('gitlab_commit_start'));

    let gitlabCommit;
    try {
      gitlabCommit = await commitFilesToGitLab({
        projectId: project.gitlab.projectId,
        branch: project.gitlab.defaultBranch || 'main',
        commitMessage: `Edit: ${message}`,
        files: generated.files,
      });
    } catch (error) {
      const errorCode = (error as any).code;
      const isProjectNotFound = errorCode === 'PROJECT_NOT_FOUND';

      stageLogs.push(logStage(isProjectNotFound ? 'gitlab_project_not_found' : 'gitlab_commit_failed'));

      if (isProjectNotFound) {
        await ProjectMessage.create({
          projectId: project._id,
          ownerId: project.ownerId,
          role: 'assistant',
          content: 'Could not commit edit because the GitLab project was not found.',
          metadata: { stage: 'gitlab_project_not_found', stageLogs },
        });
        return NextResponse.json({
          ok: false,
          error: 'Could not commit edit because the GitLab project was not found. Please reopen the latest generated site and try again.',
          stage: 'gitlab_project_not_found',
          stageLogs,
          duration_ms: Date.now() - startTime,
          debug: { projectId: project.gitlab.projectId },
        }, { status: 404 });
      }

      await ProjectMessage.create({
        projectId: project._id,
        ownerId: project.ownerId,
        role: 'assistant',
        content: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { stage: 'gitlab_commit_failed', stageLogs },
      });
      return NextResponse.json({
        ok: false,
        error: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'gitlab_commit_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        updatedSiteSpec,
        summaryOfChanges,
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_commit_done', Date.now() - startTime));

    let deployTriggered = false;
    let deployHookId = '';
    let deployNote = 'Vercel should automatically redeploy from GitLab connection.';

    stageLogs.push(logStage('vercel_redeploy_start'));

    try {
      const redeploy = await triggerVercelRedeploy(project.gitlab.projectId);
      if (redeploy.deployTriggered) {
        deployTriggered = true;
        deployHookId = redeploy.deployHookId || '';
        deployNote = 'Redeployment triggered.';
      }
    } catch (error) {
      console.error(`[PROJECTS/CHAT] Vercel redeploy trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('vercel_redeploy_done', Date.now() - startTime));

    // Update siteSpec in MongoDB and set lastEditedAt
    await WebsiteProject.updateOne(
      { _id: project._id },
      {
        $set: {
          siteSpec: updatedSiteSpec as any,
          lastEditedAt: new Date(),
          'gitlab.lastCommitSha': (gitlabCommit as any).id,
        },
      }
    );

    // Save assistant message
    const assistantMsg = new ProjectMessage({
      projectId: project._id,
      ownerId: project.ownerId,
      role: 'assistant',
      content: summaryOfChanges.join('\n'),
      metadata: { stageLogs, summaryOfChanges },
    });
    await assistantMsg.save();

    // Record action
    await ProjectAction.create({
      projectId: project._id,
      ownerId: project.ownerId,
      type: 'chat_edit',
      status: 'succeeded',
      input: { message },
      output: {
        commitSha: (gitlabCommit as any).id,
        summaryOfChanges,
        buildValidation: buildValidation ? { ok: buildValidation.ok } : null,
      },
      commitSha: (gitlabCommit as any).id,
      completedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      stage: 'site_updated',
      stageLogs,
      duration_ms: Date.now() - startTime,
      updatedSiteSpec,
      summaryOfChanges,
      gitlab: {
        projectId: project.gitlab.projectId,
        commit: gitlabCommit,
      },
      deployment: {
        provider: 'vercel',
        status: deployTriggered ? 'redeploy_triggered' : 'auto_redeploy_expected',
        deployTriggered,
        deployHookId,
        note: deployNote,
        liveUrl: project.deployment?.liveUrl || null,
      },
      generatedSiteValidation: buildValidation,
    });
  } catch (error) {
    stageLogs.push(logStage('unknown_error'));
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      error: message,
      stage: 'unknown_error',
      stageLogs,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}