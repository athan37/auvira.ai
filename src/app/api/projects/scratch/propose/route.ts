import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { proposeWebsitePlanAgent } from '@/lib/agent/proposeWebsitePlanAgent';
import type { ScratchIntake } from '@/lib/agent/schemas';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await request.json();
    const intake: ScratchIntake = {
      businessName: body.businessName || '',
      industry: body.industry || '',
      location: body.location || '',
      services: body.services || '',
      targetCustomers: body.targetCustomers || '',
      mainGoal: body.mainGoal || '',
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      desiredStyle: body.desiredStyle || '',
      notes: body.notes || '',
    };

    if (!intake.businessName || !intake.industry) {
      return NextResponse.json({ ok: false, error: 'businessName and industry are required' }, { status: 400 });
    }

    const result = await proposeWebsitePlanAgent(intake);

    return NextResponse.json({
      ok: true,
      websitePlan: result.data,
      stageLogs: result.stageLogs,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: `Plan proposal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stage: 'plan_proposal_failed',
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}