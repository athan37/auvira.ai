import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import {
  resolveWorkspaceDir,
  resolvePreviewFile,
  getContentType,
  buildPreviewNotReadyHtml,
} from '@/lib/project-workspace/codePreviewServe';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string; path?: string[] } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.projectId;
  const project = await WebsiteProject.findOne({ _id: projectId, ownerId: userId });
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const wsStatus = project.codeWorkspace?.status;
  const isSettingUp = wsStatus === 'setting_up' || wsStatus === 'not_started';

  if (!project.codeWorkspace || wsStatus !== 'ready') {
    const label =
      project.codeWorkspace?.setupLabel ||
      (isSettingUp
        ? 'Setting up your workspace…'
        : 'Code workspace is not ready yet.');
    const html = buildPreviewNotReadyHtml(projectId, label, {
      loading: isSettingUp,
    });
    console.warn(`[code-preview] workspace not ready projectId=${projectId} status=${wsStatus}`);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  }

  const requestedPath = params.path?.join('/') || 'index.html';
  const workspaceDir = resolveWorkspaceDir(project, projectId);

  const resolved = await resolvePreviewFile(workspaceDir, requestedPath);

  if (!resolved) {
    const isIndexRequest =
      requestedPath === 'index.html' || requestedPath === '' || !requestedPath;
    if (isIndexRequest) {
      const reason =
        project.codeWorkspace?.source === 'gitlab'
          ? 'This is a Next.js GitLab project without a root index.html. Build output may not be present yet.'
          : 'No index.html found in the project workspace.';
      console.warn(`[code-preview] missing index projectId=${projectId} workspace=${workspaceDir}`);
      const html = buildPreviewNotReadyHtml(projectId, reason);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      });
    }
    return NextResponse.json({ detail: 'File not found' }, { status: 404 });
  }

  try {
    const content = await fs.readFile(resolved.filePath);
    const basename = path.basename(resolved.filePath);
    const contentType = getContentType(basename);

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error(`[code-preview] read failed projectId=${projectId} path=${requestedPath}`, err);
    return NextResponse.json({ detail: 'File not found' }, { status: 404 });
  }
}
