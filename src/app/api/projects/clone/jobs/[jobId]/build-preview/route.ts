import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, PREVIEW_STEPS, BUILD_SUMMARY_ITEMS, type IBuildSummaryItem } from '@/lib/db/models/CloneJob';
import { getLLMClient } from '@/lib/llm/llmClient';
import { buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { waitForPreviewReady } from '@/lib/preview/waitForPreviewReady';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import mongoose from 'mongoose';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';
import { isCloneSandboxPreviewEnabled } from '@/lib/runtime/isCloneSandboxPreviewEnabled';
import { hasCriticalFidelityFailures } from '@/lib/agent/validateContentFidelity';
import type { TemplateSelection } from '@/lib/agent/selectTemplateAgent';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function markPreviewStepRunning(jobId: mongoose.Types.ObjectId, key: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'previewSteps.key': key },
    { $set: { 'previewSteps.$.status': 'running', 'previewSteps.$.startedAt': new Date() } }
  );
}

async function markPreviewStepDone(jobId: mongoose.Types.ObjectId, key: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'previewSteps.key': key },
    { $set: { 'previewSteps.$.status': 'done', 'previewSteps.$.completedAt': new Date() } }
  );
}

async function markPreviewStepFailed(jobId: mongoose.Types.ObjectId, key: string, error: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'previewSteps.key': key },
    { $set: { 'previewSteps.$.status': 'failed', 'previewSteps.$.error': error, 'previewSteps.$.completedAt': new Date() } }
  );
}

async function initBuildSummary(jobId: mongoose.Types.ObjectId) {
  const items = BUILD_SUMMARY_ITEMS.map(s => ({ ...s, status: 'pending' as const }));
  await CloneJob.updateOne({ _id: jobId }, {
    $set: {
      buildSummary: { status: 'generating', items },
    },
  });
}

async function markSummaryRunning(jobId: mongoose.Types.ObjectId, key: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'buildSummary.items.key': key },
    { $set: { 'buildSummary.items.$.status': 'running', 'buildSummary.items.$.updatedAt': new Date() } }
  );
}

async function markSummaryDone(jobId: mongoose.Types.ObjectId, key: string, summary?: string, data?: IBuildSummaryItem['data']) {
  const update: Record<string, unknown> = {
    'buildSummary.items.$.status': 'done',
    'buildSummary.items.$.updatedAt': new Date(),
  };
  if (summary) update['buildSummary.items.$.summary'] = summary;
  if (data) update['buildSummary.items.$.data'] = data;
  await CloneJob.updateOne({ _id: jobId, 'buildSummary.items.key': key }, { $set: update });
}

async function setBuildSummaryStatus(jobId: mongoose.Types.ObjectId, status: 'generating' | 'ready' | 'failed') {
  await CloneJob.updateOne({ _id: jobId }, { $set: { 'buildSummary.status': status } });
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

function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
}

function allocatePort(): number {
  const base = 3001 + Math.floor(Math.random() * 1000);
  return base;
}

function startPreviewServer(workspacePath: string, port: number): { process: ChildProcess } {
  const npmPath = getNpmPath();
  const args = ['run', 'dev', '--', '-H', '0.0.0.0', '-p', String(port)];

  console.log(`[preview] starting server cwd=${workspacePath} port=${port}`);
  console.log(`[preview] command: ${npmPath} ${args.join(' ')}`);

  const child = spawn(npmPath, args, {
    cwd: workspacePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: false,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  return { process: child };
}

export async function POST(
  _request: NextRequest,
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
  }).catch(() => null);

  if (!job) {
    return NextResponse.json(
      { ok: false, stage: 'job_not_found', message: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (job.status !== 'review_ready') {
    return NextResponse.json({
      ok: false,
      error: `Cannot build preview — job is in '${job.status}' state, expected 'review_ready'.`,
      status: job.status,
    }, { status: 400 });
  }

  if (job.contentFidelity && hasCriticalFidelityFailures(job.contentFidelity)) {
    const critical = job.contentFidelity.criticalIssues ?? job.contentFidelity.issues ?? [];
    return NextResponse.json({
      ok: false,
      error: `Content fidelity check failed: ${critical.join('; ')}`,
      stage: 'content_fidelity_failed',
      contentFidelity: job.contentFidelity,
    }, { status: 400 });
  }

  const jobId = job._id;
  const llmClient = getLLMClient();
  const { scratchPath } = await import('@/lib/runtime/scratchDir');
  const workspacePath = scratchPath('generated-sites', params.jobId);

  // Initialize previewSteps and buildSummary
  const stepsInit = PREVIEW_STEPS.map(s => ({ ...s, status: 'pending' as const }));
  await CloneJob.updateOne({ _id: jobId }, {
    $set: {
      status: 'preview_building',
      currentStageLabel: 'Building preview...',
      progressPercent: 10,
      previewSteps: stepsInit,
      preview: { status: 'building', startedAt: new Date() },
    },
  });
  await initBuildSummary(jobId);

  try {
    // Step 1: prepare_structure — generate site spec
    await markPreviewStepRunning(jobId, 'prepare_structure');
    await markSummaryRunning(jobId, 'hero');
    await markSummaryRunning(jobId, 'sections');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Preparing website structure...', progressPercent: 15 } });

    let siteSpec: any;
    if (job.proposedWebsitePlan && Object.keys(job.proposedWebsitePlan).length > 0) {
      siteSpec = job.proposedWebsitePlan;
    } else {
      const specResult = await llmClient.generateJSON<any>({
        system: "You are a website modernization agent. Return only JSON matching the schema.",
        prompt: buildGenerateSiteSpecPrompt(
          job.businessProfile as Record<string, unknown>,
          job.factualSiteData as Record<string, unknown>,
          ''
        ),
        schema: {} as any,
      });
      siteSpec = specResult.data;
    }
    await markPreviewStepDone(jobId, 'prepare_structure');

    // Hero summary
    const heroSection = siteSpec?.sections?.find((s: any) => s.type === 'hero');
    const heroHeadline = heroSection?.headline || siteSpec?.siteTitle || '';
    const heroSummary = heroHeadline ? `Created hero: "${heroHeadline}"` : 'Homepage hero created';
    await markSummaryDone(jobId, 'hero', heroSummary, heroHeadline ? { title: heroHeadline } : undefined);

    // Sections summary
    const sectionsList = siteSpec?.sections || [];
    const sectionsSummary = `Created ${sectionsList.length} website sections`;
    await markSummaryDone(jobId, 'sections', sectionsSummary, {
      count: sectionsList.length,
      examples: sectionsList.slice(0, 3).map((s: any) => s.title || s.type),
    });

    // Step 2: create_homepage — design brief + generate homepage
    await markPreviewStepRunning(jobId, 'create_homepage');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Creating homepage...', progressPercent: 30 } });

    let designBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        job.businessProfile as Record<string, unknown>,
        siteSpec as Record<string, unknown>,
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
    const rawTemplate = job.suggestedTemplate || { category: 'general-service', variant: 'modern-clean' };
    const { normalizeTemplateSelection } = await import('@/lib/builder/normalizeTemplateVariant');
    const template: TemplateSelection = {
      ...normalizeTemplateSelection(rawTemplate.category, rawTemplate.variant),
      reason: rawTemplate.reason || 'AI suggested',
    };
    const generated = generateWebsiteFiles(siteSpec as unknown as import('@/lib/agent/schemas').SiteSpec, uniqueName, designBrief, template);
    await markPreviewStepDone(jobId, 'create_homepage');

    // Services summary
    const servicesSection = siteSpec?.sections?.find((s: any) => s.type === 'services');
    const servicesItems = servicesSection?.items || [];
    const bp = job.businessProfile as any;
    const allServices = bp?.services || [];
    const servicesSummary = servicesItems.length > 0
      ? `Added ${servicesItems.length} services`
      : allServices.length > 0
      ? `Added ${allServices.length} services`
      : 'Services section created';
    await markSummaryDone(jobId, 'services', servicesSummary, {
      count: servicesItems.length || allServices.length,
      examples: (servicesItems.length > 0 ? servicesItems : allServices).slice(0, 3),
    });

    // Contact summary
    const contactSection = siteSpec?.sections?.find((s: any) => s.type === 'contact');
    const contactItems = contactSection?.items || [];
    const hasContactInfo = (bp?.phone || bp?.email || bp?.location) && contactSection;
    const contactSummary = hasContactInfo
      ? 'Included available contact details'
      : 'Contact section created; some details can be added later';
    await markSummaryDone(jobId, 'contact', contactSummary, {
      examples: contactItems.slice(0, 3),
    });

    // Style — start then done after
    await markSummaryRunning(jobId, 'style');

    // Steps 3-6: add_services, add_about, add_contact, apply_style
    for (const step of ['add_services', 'add_about', 'add_contact', 'apply_style'] as const) {
      await markPreviewStepRunning(jobId, step);
      await CloneJob.updateOne({ _id: jobId }, {
        $set: {
          currentStageLabel: PREVIEW_STEPS.find(s => s.key === step)?.label || step,
          progressPercent: 30 + PREVIEW_STEPS.findIndex(s => s.key === step) * 8,
        },
      });
      await new Promise(r => setTimeout(r, 200));
      await markPreviewStepDone(jobId, step);
    }

    // Style summary
    await markSummaryDone(jobId, 'style', `Applied ${template.category} / ${template.variant} style`);

    // Step 7: quality_check — validate
    await markPreviewStepRunning(jobId, 'quality_check');
    await markSummaryRunning(jobId, 'quality');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Checking website quality...', progressPercent: 60 } });

    const buildResult = await validateGeneratedSite({ files: generated.files, projectName: uniqueName });
    if (!buildResult.ok) {
      const errMsg = 'Build gate failed: ' + buildResult.errors.join('; ');
      await markPreviewStepFailed(jobId, 'quality_check', errMsg);
      throw new Error(errMsg);
    }
    await CloneJob.updateOne({ _id: jobId }, {
      $set: {
        generatedSiteValidation: {
          ok: buildResult.ok,
          logs: buildResult.logs,
          errors: buildResult.errors,
          durationMs: buildResult.durationMs,
          buildGateSkipped: buildResult.buildGateSkipped ?? false,
        },
        buildValidation: {
          ok: buildResult.ok,
          logs: buildResult.logs,
          errors: buildResult.errors,
          durationMs: buildResult.durationMs,
          buildGateSkipped: buildResult.buildGateSkipped ?? false,
        },
      },
    });
    await markPreviewStepDone(jobId, 'quality_check');
    await markSummaryDone(jobId, 'quality', buildResult.ok ? 'Website passed quality checks' : 'Quality checks failed');

    // Step 8: start_preview — write files and start dev server (local only)
    await markPreviewStepRunning(jobId, 'start_preview');
    await markSummaryRunning(jobId, 'preview');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Starting preview server...', progressPercent: 75 } });

    // Write files to workspace
    if (existsSync(workspacePath)) {
      rmSync(workspacePath, { recursive: true, force: true });
    }
    mkdirSync(workspacePath, { recursive: true });
    writeFilesToDisk(buildResult.files ?? generated.files, workspacePath);

    // Track files in technicalBuild
    await CloneJob.updateOne({ _id: jobId }, {
      $set: {
        technicalBuild: {
          workspacePath,
          files: (buildResult.files ?? generated.files).map(f => ({ path: f.filePath, status: 'done' as const })),
          validationLogs: buildResult.logs,
          buildGateSkipped: buildResult.buildGateSkipped ?? false,
        },
      },
    });

    if (isVercelServerless()) {
      let previewUrl: string | null = null;
      let sandboxNote: string | undefined;

      if (isCloneSandboxPreviewEnabled()) {
        try {
          const { bootstrapCloneJobSandbox } = await import('@/lib/sandbox/bootstrapCloneJobSandbox');
          const sandboxResult = await bootstrapCloneJobSandbox(params.jobId, buildResult.files ?? generated.files);
          previewUrl = sandboxResult.previewUrl;
          sandboxNote = 'Ephemeral sandbox preview';
        } catch (sandboxError) {
          const errMsg = sandboxError instanceof Error ? sandboxError.message : 'Sandbox preview failed';
          console.error(`[preview] clone sandbox bootstrap failed: ${errMsg}`);
          sandboxNote = `Sandbox preview unavailable: ${errMsg}. Deploy to Vercel to preview.`;
        }
      } else {
        sandboxNote = 'Live preview runs on local dev only. Review the build summary and deploy to see your site on Vercel.';
      }

      await CloneJob.updateOne({ _id: jobId }, {
        $set: {
          preview: {
            status: 'ready',
            url: previewUrl,
            port: previewUrl ? 3000 : null,
            startedAt: new Date(),
            note: sandboxNote,
            previewMode: previewUrl ? 'sandbox' : undefined,
          },
          previewSiteSpec: siteSpec,
          status: 'preview_ready',
          currentStageLabel: previewUrl ? 'Preview is ready!' : 'Ready to deploy (cloud preview unavailable)',
          progressPercent: previewUrl ? 75 : 75,
        },
      });
      await markPreviewStepDone(jobId, 'start_preview');
      await markSummaryDone(
        jobId,
        'preview',
        previewUrl ? 'Sandbox preview is ready to review' : 'Code generated — deploy to Vercel to preview'
      );
      await setBuildSummaryStatus(jobId, 'ready');

      return NextResponse.json({
        ok: true,
        jobId: job._id.toString(),
        status: 'preview_ready',
        preview: { status: 'ready', url: previewUrl, hostedPreview: Boolean(previewUrl) },
        buildGateSkipped: buildResult.buildGateSkipped ?? false,
      });
    }

    // Mark preview as starting
    const port = allocatePort();
    await CloneJob.updateOne({ _id: jobId }, {
      $set: { preview: { status: 'starting', port, startedAt: new Date() } },
    });

    const npmPath = getNpmPath();
    await new Promise<void>((resolve, reject) => {
      const npm = spawn(npmPath, ['install', '--legacy-peer-deps'], { cwd: workspacePath, shell: false });
      npm.on('close', (code) => code === 0 ? resolve() : reject(new Error(`npm install failed with code ${code}`)));
      npm.on('error', reject);
    });

    const { process: devProcess } = startPreviewServer(workspacePath, port);
    const serverPid = devProcess.pid!;

    // Collect initial logs for a few seconds before detaching
    const initialStdout: string[] = [];
    const initialStderr: string[] = [];
    devProcess.stdout?.on('data', (chunk: Buffer) => initialStdout.push(chunk.toString()));
    devProcess.stderr?.on('data', (chunk: Buffer) => initialStderr.push(chunk.toString()));

    // Wait a few seconds to collect initial startup output
    await new Promise(r => setTimeout(r, 5000));

    // Check if process is still running
    if (devProcess.exitCode !== null) {
      console.error(`[preview] server exited early with code ${devProcess.exitCode}`);
      console.error(`[preview] stdout: ${initialStdout.join('')}`);
      console.error(`[preview] stderr: ${initialStderr.join('')}`);
      throw new Error(`Preview server exited unexpectedly with code ${devProcess.exitCode}. Check preview logs.`);
    }

    // Save preview logs
    await CloneJob.updateOne({ _id: jobId }, {
      $set: {
        'technicalBuild.previewServerPid': serverPid,
        'technicalBuild.previewCommand': `npm run dev -- -H 0.0.0.0 -p ${port}`,
        'technicalBuild.previewLogs': {
          pid: serverPid,
          port,
          workspacePath,
          stdout: initialStdout.join(''),
          stderr: initialStderr.join(''),
          startedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`[preview] health check url=http://localhost:${port}`);
    console.log(`[preview] stdout:\n${initialStdout.join('')}`);
    console.log(`[preview] stderr:\n${initialStderr.join('')}`);

    // Detach: ignore streams so process keeps running in background
    devProcess.stdout?.removeAllListeners();
    devProcess.stderr?.removeAllListeners();
    devProcess.stdout?.on('error', () => {});
    devProcess.stderr?.on('error', () => {});
    devProcess.unref();

    // Wait for server to be reachable
    const previewUrl = `http://localhost:${port}`;
    try {
      await waitForPreviewReady(previewUrl, { timeoutMs: 60000, intervalMs: 1000 });
      console.log(`[preview] ready url=${previewUrl}`);
    } catch (healthError) {
      const errMsg = healthError instanceof Error ? healthError.message : 'Preview server failed to start';
      console.error(`[preview] failed: ${errMsg}`);
      // Try to get final logs
      try {
        const finalJob = await CloneJob.findById(jobId);
        const logs = (finalJob?.technicalBuild as any)?.previewLogs || {};
        console.error(`[preview] final stderr: ${logs.stderr}`);
      } catch {}
      throw new Error(errMsg);
    }

    // Mark preview ready
    await CloneJob.updateOne({ _id: jobId }, {
      $set: {
        preview: { status: 'ready', url: previewUrl, port, startedAt: new Date() },
        previewSiteSpec: siteSpec,
        status: 'preview_ready',
        currentStageLabel: 'Preview is ready!',
        progressPercent: 75,
      },
    });
    await markPreviewStepDone(jobId, 'start_preview');
    await markSummaryDone(jobId, 'preview', 'Preview is ready to review');
    await setBuildSummaryStatus(jobId, 'ready');

    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: 'preview_ready',
      preview: { status: 'ready', url: previewUrl, port },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[preview] build failed: ${errMsg}`);
    await setBuildSummaryStatus(jobId, 'failed');
    await CloneJob.updateOne({ _id: jobId }, {
      $set: {
        status: 'failed',
        currentStageLabel: 'Preview build failed',
        error: errMsg,
        'preview.status': 'failed',
        'preview.error': errMsg,
      },
    });
    return NextResponse.json({ ok: false, error: errMsg, stage: 'preview_build_failed' }, { status: 500 });
  }
}