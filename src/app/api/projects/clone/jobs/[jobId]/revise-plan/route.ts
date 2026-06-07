import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { getLLMClient } from '@/lib/llm/llmClient';
import { buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import { validateContentFidelity } from '@/lib/agent/validateContentFidelity';
import type { FactualSiteData } from '@/lib/agent/schemas';
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

  const llmClient = getLLMClient();

  try {
    // Build an extended prompt that includes the original spec + revision instruction
    const specResult = await llmClient.generateJSON<any>({
      system: "You are a website modernization agent. You may improve structure, clarity, visual hierarchy, and CTA wording based on the revision instruction, but you MUST preserve factual accuracy. Use only factualData as source of truth. Return only JSON matching the schema.",
      prompt: buildGenerateSiteSpecPrompt(
        job.businessProfile as Record<string, unknown>,
        job.factualSiteData as Record<string, unknown>,
        revisionInstruction
      ),
      schema: {},
    });

    job.proposedWebsitePlan = specResult.data;

    const fidelityResult = validateContentFidelity(
      specResult.data,
      job.factualSiteData as FactualSiteData
    );
    job.contentFidelity = {
      passed: fidelityResult.passed,
      issues: fidelityResult.issues,
      criticalIssues: fidelityResult.criticalIssues,
      warnIssues: fidelityResult.warnIssues,
      hasCriticalFailures: fidelityResult.hasCriticalFailures,
    };

    // Regenerate design brief based on revised spec
    let designBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        job.businessProfile as Record<string, unknown>,
        specResult.data as Record<string, unknown>,
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

    // Keep owner theme if they chose one; otherwise refresh AI suggestion
    const { isOwnerChosenTemplate } = await import('@/lib/builder/ownerTemplateSelection');
    if (!isOwnerChosenTemplate(job.suggestedTemplate?.reason) || !job.suggestedTemplate?.variant) {
      const template = selectTemplateAgent(job.businessProfile as any);
      job.suggestedTemplate = {
        category: template.category,
        variant: template.variant,
        reason: template.reason,
        layoutStarterId: job.suggestedTemplate?.layoutStarterId,
      };
    }

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
      reply: fidelityResult.passed
        ? 'Plan revised; content fidelity passed.'
        : `Plan revised; fidelity issues: ${fidelityResult.criticalIssues.join(', ') || fidelityResult.issues.slice(0, 3).join('; ')}`,
      outcome: fidelityResult.passed ? 'success' : 'failed',
      verifyPass: fidelityResult.passed,
      siteConfigParsed: {
        businessName: (job.businessProfile as { businessName?: string })?.businessName,
        sections: (specResult.data as { sections?: Array<{ type?: string; title?: string }> })?.sections,
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