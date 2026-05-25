import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { createProjectWorkspace, createWorkspaceSnapshot, restoreFromSnapshot } from '@/lib/project-workspace/createProjectWorkspace';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// DEPRECATED: This non-streaming edit route is deprecated.
// Owner website editing now uses Cline via /edit/stream
// This route can be removed once all clients migrate to the streaming route
const AGENT_URL = process.env.ADK_CODING_AGENT_URL || 'http://localhost:8001';

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function readWorkspaceFiles(workspacePath: string): Promise<{ index: string; css: string } | null> {
  try {
    const indexPath = path.join(workspacePath, 'index.html');
    const cssPath = path.join(workspacePath, 'styles.css');
    const index = await fs.readFile(indexPath, 'utf-8');
    const css = await fs.readFile(cssPath, 'utf-8');
    return { index, css };
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
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

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ detail: 'message is required' }, { status: 400 });
  }

  let workspacePath = project.codeWorkspace?.workspacePath;
  if (!workspacePath || project.codeWorkspace?.status !== 'ready') {
    try {
      const { workspacePath: wp, version } = await createProjectWorkspace(project);
      workspacePath = wp;

      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            'codeWorkspace.status': 'ready',
            'codeWorkspace.workspacePath': workspacePath,
            'codeWorkspace.version': version,
          }
        }
      );
    } catch (err) {
      return NextResponse.json(
        { detail: 'Failed to create workspace' },
        { status: 500 }
      );
    }
  }

  // Capture before-state
  const beforeFiles = await readWorkspaceFiles(workspacePath);
  const beforeHashes = beforeFiles ? {
    index: computeHash(beforeFiles.index),
    css: computeHash(beforeFiles.css),
  } : null;

  // Create snapshot
  const snapshotPath = await createWorkspaceSnapshot(projectId);

  try {
    const response = await fetch(`${AGENT_URL}/project-website-agent/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        workspacePath,
        message,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      if (snapshotPath) {
        await restoreFromSnapshot(projectId, snapshotPath);
      }
      return NextResponse.json(
        { detail: `Agent error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.ok) {
      // Verify files actually changed
      const afterFiles = await readWorkspaceFiles(workspacePath);
      const afterHashes = afterFiles ? {
        index: computeHash(afterFiles.index),
        css: computeHash(afterFiles.css),
      } : null;

      const filesActuallyChanged = afterHashes && beforeHashes &&
        (afterHashes.index !== beforeHashes.index || afterHashes.css !== beforeHashes.css);

      if (filesActuallyChanged) {
        const newVersion = (project.codeWorkspace?.version || 1) + 1;
        await WebsiteProject.updateOne(
          { _id: projectId },
          {
            $set: {
              'codeWorkspace.version': newVersion,
              'codeWorkspace.lastEditedAt': new Date(),
              'codeWorkspace.lastEditSummary': result.ownerMessage || '',
              'codeWorkspace.lastValidationStatus': 'passed',
              'hasUnpublishedChanges': true,
            }
          }
        );

        return NextResponse.json({
          ok: true,
          ownerMessage: result.ownerMessage,
          changedFiles: result.changedFiles || [],
          previewUpdated: true,
          version: newVersion,
        });
      } else {
        // Verification failed - files did not change
        if (snapshotPath) {
          await restoreFromSnapshot(projectId, snapshotPath);
        }
        await WebsiteProject.updateOne(
          { _id: projectId },
          {
            $set: {
              'codeWorkspace.lastValidationStatus': 'failed',
              'codeWorkspace.lastEditedAt': new Date(),
            }
          }
        );

        return NextResponse.json({
          ok: false,
          ownerMessage: "I couldn't safely apply that change, so I kept your previous preview unchanged.",
        });
      }
    } else {
      // Agent failed
      if (snapshotPath) {
        await restoreFromSnapshot(projectId, snapshotPath);
      }
      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            'codeWorkspace.lastValidationStatus': 'failed',
            'codeWorkspace.lastEditedAt': new Date(),
          }
        }
      );

      return NextResponse.json({
        ok: false,
        ownerMessage: result.ownerMessage || "I couldn't safely apply that change.",
      });
    }
  } catch (error) {
    if (snapshotPath) {
      await restoreFromSnapshot(projectId, snapshotPath);
    }

    return NextResponse.json(
      { detail: `Failed to reach coding agent: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 502 }
    );
  }
}