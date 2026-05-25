import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import {
  confirmBusinessProfile,
  getBusinessProfile,
  seedBusinessProfileFromProject,
  upsertBusinessProfile,
} from '@/lib/site-manager/businessProfile.service';
import { suggestMonitorsFromProfile } from '@/lib/site-manager/watchRules.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }

  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let profile = await getBusinessProfile(params.projectId);
  if (!profile) profile = await seedBusinessProfileFromProject(params.projectId, userId);

  return NextResponse.json({
    ok: true,
    needsSetup: !profile.confirmedAt,
    profile: {
      businessName: profile.businessName,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      hours: profile.hours,
      mainServices: profile.mainServices,
      bannerRules: profile.bannerRules ?? [],
      confirmedAt: profile.confirmedAt?.toISOString() ?? null,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const profile = await upsertBusinessProfile(params.projectId, project.ownerId.toString(), body);
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const profile = await upsertBusinessProfile(params.projectId, project.ownerId.toString(), body);
  if (body.confirm === true) {
    const confirmed = await confirmBusinessProfile(params.projectId, project.ownerId.toString());
    const monitors = await suggestMonitorsFromProfile(
      params.projectId,
      project.ownerId.toString(),
      confirmed
    );
    return NextResponse.json({ ok: true, profile: confirmed, monitorsCreated: monitors.length });
  }
  return NextResponse.json({ ok: true, profile });
}
