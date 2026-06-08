import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { WebsiteProject } from '@/models/WebsiteProject';
import { getCloneJobDisplayProgress } from '@/lib/clone/cloneJobDisplayProgress';
import mongoose from 'mongoose';

function computeCrawlSummary(crawlPages: any[]) {
  return {
    totalDiscovered: crawlPages.length,
    totalCrawled: crawlPages.filter(p => p.status === 'done').length,
    totalSkipped: crawlPages.filter(p => p.status === 'skipped').length,
    totalFailed: crawlPages.filter(p => p.status === 'failed').length,
  };
}

function computeExtractedFactsSummary(factualSiteData: any, businessProfile: any) {
  if (!factualSiteData && !businessProfile) return null;
  return {
    businessName: businessProfile?.businessName || null,
    industry: businessProfile?.industry || null,
    phone: businessProfile?.phone || null,
    email: businessProfile?.email || null,
    address: businessProfile?.address || businessProfile?.location || null,
    services: factualSiteData?.practiceAreasOrServices ||
      factualSiteData?.services ||
      businessProfile?.services ||
      [],
    serviceArea: factualSiteData?.serviceArea || null,
    hours: businessProfile?.hours || null,
    socialLinks: factualSiteData?.socialLinks || [],
    contactLinks: factualSiteData?.contactLinks || [],
    bookingLinks: factualSiteData?.bookingLinks || [],
  };
}

import { isWebsitePlanShape } from '@/lib/clone/normalizeProposedPlan';

function computeReviewChecklist(extractedFacts: ReturnType<typeof computeExtractedFactsSummary>, proposedWebsitePlan: unknown) {
  const requiredWarnings: string[] = [];
  const optionalWarnings: string[] = [];

  if (!extractedFacts?.businessName) {
    requiredWarnings.push('Business name not found on crawled pages. You can add it later.');
  }
  if (!extractedFacts?.phone && !extractedFacts?.email) {
    requiredWarnings.push('No phone or email found. Contact details can be added later.');
  }

  if (!extractedFacts?.services || extractedFacts.services.length === 0) {
    optionalWarnings.push('No services found on crawled pages.');
  }

  let sectionCount = 0;
  if (proposedWebsitePlan && typeof proposedWebsitePlan === 'object') {
    const plan = proposedWebsitePlan as Record<string, unknown>;
    if (isWebsitePlanShape(plan)) {
      sectionCount = (plan.contentPlan as { sections?: unknown[] })?.sections?.length ?? 0;
      const missing = plan.requiredMissingInfo as string[] | undefined;
      if (missing?.length) {
        optionalWarnings.push(...missing.map((m) => `Plan notes missing: ${m}`));
      }
    } else {
      sectionCount = (plan.sections as unknown[] | undefined)?.length ?? 0;
    }
  }

  if (sectionCount === 0) {
    optionalWarnings.push('Proposed website has no sections.');
  }

  return {
    businessNameFound: !!extractedFacts?.businessName,
    contactInfoFound: !!(extractedFacts?.phone || extractedFacts?.email),
    servicesFound: !!(extractedFacts?.services && extractedFacts.services.length > 0),
    sectionsFound: sectionCount > 0,
    requiredWarnings,
    optionalWarnings,
  };
}

export async function GET(
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
  });

  if (!job) {
    return NextResponse.json(
      { ok: false, stage: 'job_not_found', message: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  const crawlSummary = computeCrawlSummary(job.crawlPages as any[]);
  const extractedFactsSummary = computeExtractedFactsSummary(job.factualSiteData as any, job.businessProfile as any);
  const reviewChecklist = computeReviewChecklist(extractedFactsSummary, job.proposedWebsitePlan as any);
  const elapsedSeconds = job.createdAt
    ? Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 1000)
    : 0;
  const secondsAgo = job.updatedAt
    ? Math.floor((Date.now() - new Date(job.updatedAt).getTime()) / 1000)
    : 0;

  // Fetch GitLab info from the created WebsiteProject if available
  let gitlabInfo = null;
  if (job.createdProjectId) {
    try {
      const project = await WebsiteProject.findById(job.createdProjectId);
      if (project?.gitlab) {
        gitlabInfo = {
          repoUrl: (project.gitlab as any).repoUrl || null,
          webUrl: (project.gitlab as any).webUrl || null,
          httpUrlToRepo: (project.gitlab as any).httpUrlToRepo || null,
        };
      }
    } catch {}
  }

  // Legacy: job.status was incorrectly set to Vercel's "ready" instead of "completed"
  if (job.status === 'ready') {
    await CloneJob.updateOne(
      { _id: job._id },
      { $set: { status: 'completed', currentStageLabel: 'Website ready', progressPercent: 100 } }
    );
    job.status = 'completed';
    job.progressPercent = 100;
    job.currentStageLabel = 'Website ready';
  }

  // If deploying, check Vercel status and transition if ready
  // Also handle case where deployment is already marked ready in DB
  const needsTransition =
    job.status === 'deploying' &&
    ((job.deployment?.vercelProjectId || job.deployment?.vercelProjectName) || job.deployment?.ready);

  if (needsTransition) {
    try {
      // If already ready in DB, skip Vercel check
      if (job.deployment?.ready || job.deployment?.status === 'ready') {
        console.log(`[GET /clone/jobs/${params.jobId}] Deployment already marked ready in DB, normalizing status`);
        const updates: Record<string, unknown> = {
          status: 'completed',
          currentStageLabel: 'Website ready',
          progressPercent: 100,
        };
        await CloneJob.updateOne({ _id: job._id }, { $set: updates });
        job.status = 'completed';
        job.progressPercent = 100;
        job.currentStageLabel = 'Website ready';
      } else {
        const { checkVercelDeployment } = await import('@/lib/vercel/checkDeployment');
        console.log(`[GET /clone/jobs/${params.jobId}] Checking Vercel deployment by projectId=${job.deployment?.vercelProjectId} projectName=${job.deployment?.vercelProjectName}`);
        const vercelStatus = await checkVercelDeployment(
          job.deployment?.vercelProjectId as string | undefined,
          job.deployment?.vercelProjectName as string | undefined
        );
        console.log(`[GET /clone/jobs/${params.jobId}] Vercel result: status=${vercelStatus.status} foundBy=${vercelStatus.foundBy}`);

        if (vercelStatus.status === 'ready' || vercelStatus.status === 'failed') {
          const deployReady = vercelStatus.status === 'ready';
          const jobStatus = deployReady ? 'completed' : 'failed';
          console.log(`[GET /clone/jobs/${params.jobId}] Deployment ${vercelStatus.status} foundBy=${vercelStatus.foundBy} — transitioning CloneJob to ${jobStatus}`);
          const updates: Record<string, unknown> = {
            status: jobStatus,
            currentStageLabel: deployReady ? 'Website ready' : 'Deployment failed',
            progressPercent: deployReady ? 100 : job.progressPercent,
            'deployment.status': deployReady ? 'ready' : 'failed',
            'deployment.ready': deployReady,
            'deployment.liveUrl': vercelStatus.liveUrl ?? null,
            'deployment.deploymentUrl': vercelStatus.deploymentUrl ?? null,
            'deployment.inspectorUrl': vercelStatus.inspectorUrl ?? null,
          };
          if (vercelStatus.error) updates['deployment.error'] = vercelStatus.error;

          await CloneJob.updateOne({ _id: job._id }, { $set: updates });

          // Stop preview server when deployment completes (not on failure — keep preview available for retry)
          if (deployReady && job.preview?.port) {
            const { stopPreviewServerByPort } = await import('@/lib/preview/stopPreviewServer');
            stopPreviewServerByPort(job.preview.port).catch(() => {});
            await CloneJob.updateOne({ _id: job._id }, { $set: { 'preview.status': 'stopped' } });
            console.log(`[GET /clone/jobs/${params.jobId}] Preview server stopped after deployment ready`);
          }

          if (job.createdProjectId) {
            const { WebsiteProject } = await import('@/models/WebsiteProject');
            await WebsiteProject.updateOne(
              { _id: job.createdProjectId },
              {
                $set: {
                  'deployment.status': deployReady ? 'ready' : 'failed',
                  'deployment.ready': deployReady,
                  'deployment.liveUrl': vercelStatus.liveUrl ?? null,
                  'deployment.deploymentUrl': vercelStatus.deploymentUrl ?? null,
                  'deployment.inspectorUrl': vercelStatus.inspectorUrl ?? null,
                  ...(deployReady ? { status: 'deployed' } : {}),
                },
              }
            );
          }

          // Update local job object for response
          job.status = jobStatus;
          if (vercelStatus.liveUrl) job.deployment!.liveUrl = vercelStatus.liveUrl;
          if (vercelStatus.deploymentUrl) job.deployment!.deploymentUrl = vercelStatus.deploymentUrl;
          if (vercelStatus.inspectorUrl) job.deployment!.inspectorUrl = vercelStatus.inspectorUrl;
          (job.deployment as any).status = deployReady ? 'ready' : 'failed';
          (job.deployment as any).ready = deployReady;
          job.progressPercent = deployReady ? 100 : job.progressPercent;
          job.currentStageLabel = deployReady ? 'Website ready' : 'Deployment failed';
        }
      }
    } catch (err) {
      // Non-fatal — log and continue with cached state
      console.error('[check-deployment] Vercel status check failed:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: job._id.toString(),
      sourceUrl: job.sourceUrl,
      projectName: job.projectName,
      status: job.status,
      currentStageLabel: job.currentStageLabel,
      progressPercent: getCloneJobDisplayProgress(job.status, job.progressPercent),
      elapsedSeconds,
      secondsAgo,
      updatedAt: job.updatedAt,

      crawlSummary,
      crawlPages: job.crawlPages,

      extractedFactsSummary,
      factualSiteData: job.factualSiteData,
      businessProfile: job.businessProfile,
      proposedWebsitePlan: job.proposedWebsitePlan,
      suggestedTemplate: job.suggestedTemplate,
      contentFidelity: job.contentFidelity,
      reviewChecklist,

      buildSteps: job.buildSteps,
      previewSteps: job.previewSteps,
      buildSummary: job.buildSummary,
      deployment: job.deployment,
      preview: job.preview,
      previewSiteSpec: job.previewSiteSpec,
      technicalBuild: job.technicalBuild,
      gitlab: gitlabInfo,
      generatedSiteValidation: job.generatedSiteValidation,

      error: job.error,
      createdProjectId: job.createdProjectId ? (job.createdProjectId as any).toString() : undefined,
      logs: job.logs.map((l: any) => ({
        timestamp: l.timestamp,
        stage: l.stage,
        message: l.message,
        data: l.data,
      })),
      createdAt: job.createdAt,
    },
  });
}