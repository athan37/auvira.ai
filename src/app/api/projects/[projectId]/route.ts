import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { hasUncommittedChanges } from '@/lib/project-workspace/gitWorkspaceManager';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, stage: 'project_not_found', message: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const hasLocalGitChanges =
    project.codeWorkspace?.status === 'ready' &&
    project.codeWorkspace?.source === 'gitlab' &&
    (await hasUncommittedChanges(params.projectId));

  return NextResponse.json({
    ok: true,
    project: {
      id: project._id.toString(),
      mode: project.mode,
      name: project.name,
      sourceUrl: project.sourceUrl,
      siteSpec: project.siteSpec,
      draftSiteSpec: project.draftSiteSpec,
      businessProfile: project.businessProfile,
      websitePlan: project.websitePlan,
      factualSiteData: project.factualSiteData,
      template: project.template,
      generatedSiteValidation: project.generatedSiteValidation,
      contentFidelity: project.contentFidelity,
      scratchValidation: project.scratchValidation,
      gitlab: project.gitlab,
      deployment: project.deployment,
      preview: project.preview,
      codeWorkspace: project.codeWorkspace,
      editingMode: 'code',
      status: project.status,
      hasUnpublishedChanges: project.hasUnpublishedChanges,
      hasLocalGitChanges,
      needsSave: Boolean(project.hasUnpublishedChanges || hasLocalGitChanges),
      lastPreviewEditedAt: project.lastPreviewEditedAt,
      lastPublishedAt: project.lastPublishedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      lastEditedAt: project.lastEditedAt,
    },
  });
}