import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { resolveScratchIntake } from '@/lib/agent/buildWebsiteFromPlan';
import { reviseWebsitePlanAgent } from '@/lib/agent/reviseWebsitePlanAgent';
import type { ScratchIntake, WebsitePlan } from '@/lib/agent/schemas';
import { applyScratchTemplateSelectionToPlan } from '@/lib/scratch/applyScratchTemplateSelectionToPlan';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const {
      websitePlan,
      instruction,
      layoutStarterId,
      templateCategory,
      templateVariant,
      intake: intakeBody,
    } = body as {
      websitePlan: WebsitePlan;
      instruction?: string;
      layoutStarterId?: string;
      templateCategory?: string;
      templateVariant?: string;
      intake?: Partial<ScratchIntake>;
    };

    if (!websitePlan) {
      return NextResponse.json({ ok: false, error: 'websitePlan is required' }, { status: 400 });
    }

    const revisionInstruction = (instruction || body.message || '').trim();
    if (!revisionInstruction) {
      return NextResponse.json({ ok: false, error: 'instruction is required' }, { status: 400 });
    }

    const intake = resolveScratchIntake(websitePlan, intakeBody);
    const result = await reviseWebsitePlanAgent(intake, websitePlan, revisionInstruction);
    const revisedPlan = applyScratchTemplateSelectionToPlan(result.data, {
      layoutStarterId: layoutStarterId ?? websitePlan.suggestedTemplate?.layoutStarterId,
      templateCategory: templateCategory ?? websitePlan.suggestedTemplate?.category,
      templateVariant: templateVariant ?? websitePlan.suggestedTemplate?.variant,
    });

    return NextResponse.json({
      ok: true,
      websitePlan: revisedPlan,
      layoutStarterId: revisedPlan.suggestedTemplate.layoutStarterId,
      stageLogs: result.stageLogs,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Plan revision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'plan_revision_failed',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
