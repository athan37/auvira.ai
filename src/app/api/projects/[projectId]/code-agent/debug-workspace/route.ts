import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { getGitWorkspacePath, workspaceExists } from '@/lib/project-workspace/gitWorkspaceManager';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function getVisibleText(html: string): string {
  let text = html.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  // Only available in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ detail: 'Not available in production' }, { status: 404 });
  }

  const projectId = params.projectId;

  const project = await WebsiteProject.findOne({ _id: projectId, ownerId: userId });
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const source = project.codeWorkspace?.source || 'generated';
  let workspacePath: string;

  if (source === 'gitlab' && project.gitlab?.repoUrl) {
    workspacePath = getGitWorkspacePath(projectId);
  } else {
    const { scratchPath } = await import('@/lib/runtime/scratchDir');
    workspacePath = project.codeWorkspace?.workspacePath || scratchPath('project-workspaces', projectId);
  }

  if (!(await workspaceExists(projectId)) && source === 'generated') {
    if (!project.codeWorkspace?.workspacePath) {
      return NextResponse.json({ detail: 'No workspace' }, { status: 404 });
    }
  }

  try {
    const stats = await fs.stat(workspacePath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ detail: 'Workspace path is not a directory' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ detail: 'Workspace does not exist' }, { status: 404 });
  }

  try {
    const files: Array<{
      path: string;
      size: number;
      updatedAt: string;
      sha256: string;
    }> = [];

    const indexPath = path.join(workspacePath, 'index.html');
    const cssPath = path.join(workspacePath, 'styles.css');

    // Get index.html info
    try {
      const indexStats = await fs.stat(indexPath);
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      files.push({
        path: 'index.html',
        size: indexStats.size,
        updatedAt: indexStats.mtime.toISOString(),
        sha256: computeHash(indexContent),
      });
    } catch {
      // File doesn't exist
    }

    // Get styles.css info
    try {
      const cssStats = await fs.stat(cssPath);
      const cssContent = await fs.readFile(cssPath, 'utf-8');
      files.push({
        path: 'styles.css',
        size: cssStats.size,
        updatedAt: cssStats.mtime.toISOString(),
        sha256: computeHash(cssContent),
      });
    } catch {
      // File doesn't exist
    }

    // Get preview text from index.html
    let indexPreviewText = '';
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      indexPreviewText = getVisibleText(indexContent).slice(0, 1000);
    } catch {
      indexPreviewText = '';
    }

    return NextResponse.json({
      workspacePath,
      source,
      version: project.codeWorkspace?.version || 1,
      files,
      indexPreviewText,
    });
  } catch (error) {
    return NextResponse.json(
      { detail: `Failed to read workspace: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}