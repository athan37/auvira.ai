import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { getLLMClient } from '@/lib/llm/llmClient';
import { buildApplyEditPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  const job = await CloneJob.findOne({
    _id: new mongoose.Types.ObjectId(params.jobId),
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  if (!job) {
    return NextResponse.json(
      { ok: false, stage: 'job_not_found', message: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (job.status !== 'preview_ready') {
    return NextResponse.json({
      ok: false,
      error: `Cannot chat-edit preview — job is in '${job.status}' state, expected 'preview_ready'.`,
      status: job.status,
    }, { status: 400 });
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ ok: false, error: 'Message is required.' }, { status: 400 });
  }

  const llmClient = getLLMClient();
  const { scratchPath } = await import('@/lib/runtime/scratchDir');
  const workspacePath =
    job.technicalBuild?.workspacePath || scratchPath('generated-sites', params.jobId);

  try {
    // Step 1: Load current previewSiteSpec and generate updated spec
    const currentSpec = job.previewSiteSpec as Record<string, unknown>;
    if (!currentSpec) {
      return NextResponse.json({ ok: false, error: 'No preview site spec found.' }, { status: 400 });
    }

    const editResult = await llmClient.generateJSON<{ updatedSiteSpec: any; summaryOfChanges: string[] }>({
      system: "You are an AI website maintenance agent. Update the existing site spec according to the user's requested edit. Preserve the business identity and existing structure unless the user asks to change it. Return only JSON matching the schema.",
      prompt: buildApplyEditPrompt(message, currentSpec),
      schema: {} as any,
    });

    const updatedSiteSpec = editResult.data.updatedSiteSpec;
    const summaryOfChanges = editResult.data.summaryOfChanges || [];

    // Step 2: Regenerate files with updated spec
    let designBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        job.businessProfile as Record<string, unknown>,
        updatedSiteSpec as Record<string, unknown>,
        job.sourceUrl
      );
    } catch {
      const bp = job.businessProfile as any;
      designBrief = getDefaultDesignBrief(
        bp.industry?.toLowerCase().includes('legal') ? 'legal' :
        bp.industry?.toLowerCase().includes('health') ? 'healthcare' :
        bp.industry?.toLowerCase().includes('restaurant') ? 'restaurant' :
        bp.industry?.toLowerCase().includes('plumb') || bp.industry?.toLowerCase().includes('hvac') ? 'home-services' : 'general-service'
      );
    }

    const uniqueName = generateUniqueProjectName(job.projectName || (job.businessProfile as any)?.businessName || 'generated-site');
    const template = job.suggestedTemplate || { category: 'general-service', variant: 'modern-clean' };
    const generated = generateWebsiteFiles(updatedSiteSpec as unknown as import('@/lib/agent/schemas').SiteSpec, uniqueName, designBrief, template);

    // Step 3: Validate files (sync only, skip full build for speed)
    const validationErrors = validateGeneratedFiles(updatedSiteSpec, uniqueName);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'Generated files have issues: ' + validationErrors.map(e => `${e.file}: ${e.error}`).join('; '),
        stage: 'validation_failed',
      }, { status: 422 });
    }

    // Step 4: Write updated files to workspace (overwrite)
    writeFilesToDisk(generated.files, workspacePath);

    // Step 5: Update CloneJob with new spec and files
    await CloneJob.updateOne({ _id: job._id }, {
      $set: {
        previewSiteSpec: updatedSiteSpec,
        'technicalBuild.files': generated.files.map(f => ({ path: f.filePath, status: 'done' as const })),
      },
    });

    // Next.js HMR will pick up the changes automatically
    return NextResponse.json({
      ok: true,
      status: 'preview_ready',
      summary: summaryOfChanges,
      message: 'Preview updated! Your changes are now live in the preview.',
      previewUrl: job.preview?.url,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: errMsg, stage: 'preview_edit_failed' }, { status: 500 });
  }
}