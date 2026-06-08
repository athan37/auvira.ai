import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { reviseWebsitePlanAgent } from '@/lib/agent/reviseWebsitePlanAgent';
import { validateClonePlanWarnings } from '@/lib/agent/validateClonePlanWarnings';
import type { BusinessProfile, FactualSiteData, WebsitePlan } from '@/lib/agent/schemas';
import { resolveCloneIntake } from '@/lib/clone/resolveCloneIntake';
import { normalizeProposedPlan } from '@/lib/clone/normalizeProposedPlan';
import { applyScratchTemplateSelectionToPlan } from '@/lib/scratch/applyScratchTemplateSelectionToPlan';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import {
  countCloneObservabilityTurns,
  recordCloneObservabilityTurn,
} from '@/lib/observability/recordCloneTurn';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

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

  if (job.status !== 'review_ready') {
    return NextResponse.json({
      ok: false,
      error: `Cannot revise plan. Job status is "${job.status}", expected "review_ready".`,
    }, { status: 400 });
  }

  let revisionInstruction = '';
  try {
    const body = await request.json();
    revisionInstruction = body.instruction || body.message || '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!revisionInstruction.trim()) {
    return NextResponse.json({ ok: false, error: 'No revision instruction provided' }, { status: 400 });
  }

  try {
    const factualSiteData = job.factualSiteData as FactualSiteData;
    const businessProfile = job.businessProfile as BusinessProfile;
    const intake = resolveCloneIntake(factualSiteData, businessProfile);

    const currentPlan = normalizeProposedPlan(
      job.proposedWebsitePlan,
      factualSiteData.businessName || businessProfile.businessName,
      factualSiteData.industry || businessProfile.industry
    );

    if (!currentPlan) {
      return NextResponse.json({ ok: false, error: 'No proposed plan to revise' }, { status: 400 });
    }

    const reviseResult = await reviseWebsitePlanAgent(
      intake,
      currentPlan,
      revisionInstruction,
      { factualSiteData, businessProfile }
    );

    let websitePlan = reviseResult.data;

    const { isOwnerChosenTemplate } = await import('@/lib/builder/ownerTemplateSelection');
    if (isOwnerChosenTemplate(job.suggestedTemplate?.reason) && job.suggestedTemplate?.variant) {
      websitePlan = applyScratchTemplateSelectionToPlan(websitePlan, {
        layoutStarterId: job.suggestedTemplate.layoutStarterId,
        templateCategory: job.suggestedTemplate.category,
        templateVariant: job.suggestedTemplate.variant,
      });
    } else {
      const template = selectTemplateAgent(businessProfile);
      job.suggestedTemplate = {
        category: template.category,
        variant: template.variant,
        reason: template.reason,
        layoutStarterId: job.suggestedTemplate?.layoutStarterId,
      };
    }

    const planWarnings = validateClonePlanWarnings(websitePlan, factualSiteData);
    job.proposedWebsitePlan = websitePlan as WebsitePlan;
    job.contentFidelity = {
      passed: true,
      issues: [...planWarnings.warnings, ...planWarnings.suggestions],
      criticalIssues: [],
      warnIssues: planWarnings.warnings,
      hasCriticalFailures: false,
    };

    await CloneJob.updateOne(
      { _id: job._id },
      {
        $set: {
          proposedWebsitePlan: job.proposedWebsitePlan,
          suggestedTemplate: job.suggestedTemplate,
          contentFidelity: job.contentFidelity,
        },
        $push: {
          logs: {
            timestamp: new Date(),
            stage: 'planning',
            message: `Plan revised with instruction: "${revisionInstruction}"`,
          },
        },
      }
    );

    const reviseCount =
      (job.logs ?? []).filter((entry: { stage?: string }) => entry.stage === 'observability').length + 1;
    await recordCloneObservabilityTurn({
      jobId: job._id.toString(),
      projectTitle: job.projectName || job.sourceUrl || 'Clone job',
      phase: 'revise-plan',
      turnId: `${job._id.toString()}-revise-${reviseCount}`,
      turnIndex: countCloneObservabilityTurns(job.logs) + 1,
      userMessage: revisionInstruction.trim(),
      reply: planWarnings.warnings.length
        ? `Plan revised; review warnings: ${planWarnings.warnings.slice(0, 3).join('; ')}`
        : 'Plan revised.',
      outcome: 'success',
      verifyPass: true,
      siteConfigParsed: {
        businessName: websitePlan.businessName,
        sections: websitePlan.contentPlan?.sections,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: job.status,
      proposedWebsitePlan: job.proposedWebsitePlan,
      suggestedTemplate: job.suggestedTemplate,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Revision failed',
    }, { status: 500 });
  }
}
