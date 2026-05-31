import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient } from '@/lib/llm/llmClient';
import { editResultSchema, type SiteSpec, type DesignBrief } from '@/lib/agent/schemas';
import { buildApplyEditPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { triggerVercelRedeploy } from '@/lib/vercel/triggerRedeploy';

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
  console.log(`[EDIT] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  return entry;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const stageLogs: StageLog[] = [];

  try {
    const body = await request.json();
    const { projectId, siteSpec, editRequest, branch, liveUrl, designBrief: existingDesignBrief, validateBuild = true } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    if (!siteSpec) {
      return NextResponse.json({ error: 'siteSpec is required' }, { status: 400 });
    }

    if (!editRequest) {
      return NextResponse.json({ error: 'editRequest is required' }, { status: 400 });
    }

    const llmClient = getLLMClient();

    stageLogs.push(logStage('llm_edit_start'));

    let editResult;
    try {
      editResult = await llmClient.generateJSON<{ updatedSiteSpec: SiteSpec; summaryOfChanges: string[] }>({
        system: "You are an AI website maintenance agent. Update the existing site spec according to the user's requested edit. Preserve the business identity and existing structure unless the user asks to change it. Return only JSON matching the schema.",
        prompt: buildApplyEditPrompt(editRequest, siteSpec as Record<string, unknown>),
        schema: editResultSchema,
      });
    } catch (error) {
      stageLogs.push(logStage('llm_edit_failed'));
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

    // Regenerate design brief based on updated site spec
    stageLogs.push(logStage('design_brief_start'));

    let designBrief: DesignBrief;
    try {
      // Reconstruct a minimal business profile from the site spec for design brief
      const businessProfileForDesign = {
        businessName: siteSpec.siteTitle.split(' - ')[0] || siteSpec.siteTitle,
        industry: existingDesignBrief?.industryTheme || 'general-service',
        description: siteSpec.sections.find((s: { type: string }) => s.type === 'about')?.body || '',
        services: siteSpec.sections.find((s: { type: string }) => s.type === 'services')?.items || [],
        location: '',
        phone: '',
        email: '',
        brandTone: siteSpec.designDirection?.tone || '',
        targetCustomers: [],
      };
      designBrief = await generateDesignBriefAgent(
        businessProfileForDesign,
        updatedSiteSpec as unknown as Record<string, unknown>,
        existingDesignBrief ? (existingDesignBrief as any).sourceUrl || 'https://example.com' : 'https://example.com'
      );
    } catch (error) {
      stageLogs.push(logStage('design_brief_failed'));
      designBrief = existingDesignBrief || getDefaultDesignBrief();
      console.error(`[EDIT] Design brief regeneration failed, using existing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('design_brief_done', Date.now() - startTime));

    stageLogs.push(logStage('build_files_start'));

    let generated;
    try {
      generated = generateWebsiteFiles(updatedSiteSpec, 'updated-site', designBrief);
    } catch (error) {
      stageLogs.push(logStage('build_files_failed'));
      return NextResponse.json({
        ok: false,
        error: `File generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'build_files_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        updatedSiteSpec,
        summaryOfChanges,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_files_done', Date.now() - startTime));

    // Validate generated files before committing
    stageLogs.push(logStage('validate_files_start'));

    const validationErrors = validateGeneratedFiles(generated.files);
    if (validationErrors.length > 0) {
      stageLogs.push(logStage('validate_files_failed'));
      const errorList = validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
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

    // BUILD GATE: validate generated site builds before committing
    let buildValidation: { ok: boolean; tempDir: string; logs: string; errors: string[]; durationMs: number } | null = null;

    if (validateBuild) {
      stageLogs.push(logStage('build_gate_start'));

      const buildResult = await validateGeneratedSite({
        files: generated.files,
        projectName: `edit-${projectId}`,
      });

      buildValidation = {
        ok: buildResult.ok,
        tempDir: buildResult.tempDir,
        logs: buildResult.logs,
        errors: buildResult.errors,
        durationMs: buildResult.durationMs,
      };

      if (!buildResult.ok) {
        // Build failed - do not commit, do not deploy. Previous site stays live.
        stageLogs.push(logStage('build_gate_failed'));
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
    }

    stageLogs.push(logStage('gitlab_commit_start'));

    let gitlabCommit;
    try {
      gitlabCommit = await commitFilesToGitLab({
        projectId,
        branch: branch || 'main',
        commitMessage: `Edit: ${editRequest}`,
        files: generated.files,
      });
    } catch (error) {
      const errorCode = (error as any).code;
      const isProjectNotFound = errorCode === 'PROJECT_NOT_FOUND';

      stageLogs.push(logStage(isProjectNotFound ? 'gitlab_project_not_found' : 'gitlab_commit_failed'));

      if (isProjectNotFound) {
        return NextResponse.json({
          ok: false,
          error: 'Could not commit edit because the GitLab project was not found. Please reopen the latest generated site and try again.',
          stage: 'gitlab_project_not_found',
          stageLogs,
          duration_ms: Date.now() - startTime,
          debug: { projectId },
        }, { status: 404 });
      }

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

    // Try to trigger Vercel redeploy
    let vercelProjectName = '';
    let deployHookId = '';
    let deployTriggered = false;
    let deployNote = 'Vercel should automatically redeploy from GitLab connection. If not, trigger manually from Vercel dashboard.';
    let deployStatus: 'redeploy_triggered' | 'auto_redeploy_expected' = 'auto_redeploy_expected';

    stageLogs.push(logStage('vercel_redeploy_start'));

    try {
      const redeploy = await triggerVercelRedeploy(projectId);
      if (redeploy.deployTriggered) {
        deployTriggered = true;
        deployStatus = 'redeploy_triggered';
        deployHookId = redeploy.deployHookId || '';
        deployNote = 'Redeployment triggered. May take 1-3 minutes.';
      }
    } catch (error) {
      // Non-fatal - Vercel may still redeploy from GitLab webhook
      console.error(`[EDIT] Vercel redeploy trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('vercel_redeploy_done', Date.now() - startTime));

    return NextResponse.json({
      ok: true,
      stage: 'site_updated',
      stageLogs,
      duration_ms: Date.now() - startTime,
      updatedSiteSpec,
      summaryOfChanges,
      gitlab: {
        projectId,
        commit: gitlabCommit,
      },
      deployment: {
        provider: 'vercel',
        status: deployStatus,
        liveUrl: liveUrl || '',
        vercelProjectName,
        deployHookId,
        deployTriggered,
        note: deployNote,
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