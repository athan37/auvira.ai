import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { listIncidents } from '@/lib/site-manager/incidents.service';
import { SiteFixProposal } from '@/models/SiteFixProposal';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const incidents = await listIncidents(params.projectId);
  const out = await Promise.all(
    incidents.map(async (inc) => {
      let proposal = null;
      if (inc.activeProposalId) {
        const p = await SiteFixProposal.findById(inc.activeProposalId);
        if (p) {
          proposal = { id: p._id.toString(), title: p.title, plainEnglishSummary: p.plainEnglishSummary };
        }
      }
      return {
        id: inc._id.toString(),
        type: inc.type,
        status: inc.status,
        expectedValue: inc.expectedValue,
        observedValue: inc.observedValue,
        proposal,
      };
    })
  );
  return NextResponse.json({ ok: true, incidents: out });
}
