/**
 * Owner website editing — TypeScript WebsiteEditAgent + validation + ProjectEditJob.
 * Save commits local changes to GitLab. Deploy is handled by /code-agent/deploy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { createProjectWorkspace } from '@/lib/project-workspace/createProjectWorkspace';
import { ensureGitWorkspace } from '@/lib/project-workspace/gitWorkspaceManager';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import { createDirectorySnapshot, restoreDirectorySnapshot } from '@/lib/project-workspace/snapshotManager';
import { validateWorkspace } from '@/lib/project-workspace/validateWorkspace';
import { buildChangedFileDetails, getChangedPathsFromHashes } from '@/lib/project-workspace/workspaceDiff';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import {
  createEditJob,
  appendEditJobLog,
  markEditJobStatus,
  attachChangedFiles,
} from '@/lib/project-workspace/editJobLogger';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BLOCKED_PATTERNS = [
  '.env', '.env.local', '.env.production', '.env.development',
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage',
  'private.key', 'id_rsa', 'id_ed25519',
  '.pem', '.key', '.p12', '.crt',
];

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function isBlockedPath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return BLOCKED_PATTERNS.some(
    (blocked) =>
      lower === blocked ||
      lower.startsWith(`${blocked}/`) ||
      lower.includes(`/${blocked}/`)
  );
}

async function computeGitWorkspaceHashes(workspacePath: string): Promise<Record<string, string>> {
  return computeWorkspaceHashes(workspacePath);
}

async function computeStaticWorkspaceHashes(workspacePath: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const fn of ['index.html', 'styles.css', 'site.json']) {
    try {
      const content = await fs.readFile(path.join(workspacePath, fn), 'utf-8');
      hashes[fn] = computeHash(content);
    } catch {
      // file missing
    }
  }
  return hashes;
}

async function computeHashes(workspacePath: string, source: 'gitlab' | 'generated') {
  return source === 'gitlab'
    ? computeGitWorkspaceHashes(workspacePath)
    : computeStaticWorkspaceHashes(workspacePath);
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
  const { message, attachments: rawAttachments } = body;
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ detail: 'message is required' }, { status: 400 });
  }

  const attachments: WorkspaceAssetAttachment[] = Array.isArray(rawAttachments)
    ? rawAttachments
        .filter(
          (item: unknown): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object'
        )
        .map((item) => ({
          id: String(item.id || ''),
          path: String(item.path || ''),
          publicUrl: String(item.publicUrl || ''),
          previewUrl: String(item.previewUrl || item.publicUrl || ''),
          originalName: String(item.originalName || 'image'),
          mimeType: String(item.mimeType || 'image/jpeg'),
          size: Number(item.size) || 0,
        }))
        .filter((item) => item.path && item.publicUrl)
    : [];

  const previewVersionBefore = project.codeWorkspace?.version || 1;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let streamClosed = false;

      function emit(type: string, data: Record<string, unknown> = {}) {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
        } catch {
          streamClosed = true;
        }
      }

      function closeStream() {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      let jobId = '';
      let snapshotPath: string | null = null;
      let workspacePath = '';
      let source: 'gitlab' | 'generated' = 'generated';
      let mode: 'gitlab' | 'static' = 'static';
      let beforeHashes: Record<string, string> = {};

      const fail = async (ownerMessage: string, technicalDetail?: string) => {
        if (jobId) {
          await markEditJobStatus(jobId, 'failed', { error: ownerMessage });
          if (technicalDetail && technicalDetail !== ownerMessage) {
            await appendEditJobLog(jobId, 'error_detail', technicalDetail);
          }
        }
        emit('done', {
          ok: false,
          jobId,
          result: { ok: false, ownerMessage, jobId },
        });
        closeStream();
      };

      const keepPartialChanges = async (summary: string) => {
        if (!jobId || !workspacePath) return false;
        const afterHashes = await computeHashes(workspacePath, source);
        const changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes).filter(
          (f) => !isBlockedPath(f)
        );
        if (changedPaths.length === 0) return false;

        const changedFiles = await buildChangedFileDetails(
          workspacePath,
          beforeHashes,
          afterHashes,
          snapshotPath
        );
        await attachChangedFiles(jobId, changedFiles);
        const newVersion = previewVersionBefore + 1;
        await WebsiteProject.updateOne(
          { _id: projectId },
          {
            $set: {
              'codeWorkspace.version': newVersion,
              'codeWorkspace.lastEditedAt': new Date(),
              'codeWorkspace.lastEditSummary': summary,
              'codeWorkspace.lastValidationStatus': 'failed',
              'codeWorkspace.source': source,
              'codeWorkspace.status': 'ready',
              'codeWorkspace.workspacePath': workspacePath,
              hasUnpublishedChanges: true,
              editingMode: 'code',
            },
          }
        );
        await appendEditJobLog(jobId, 'partial_changes_kept', 'Local preview changes preserved', {
          changedPaths,
        });
        return true;
      };

      try {
        const job = await createEditJob({
          projectId,
          userId,
          prompt: message,
          previewVersionBefore,
        });
        jobId = job._id.toString();
        emit('step', { id: 'loading', label: 'Loading your website draft', status: 'active', jobId });

        await appendEditJobLog(jobId, 'workspace_prepare_started', 'Preparing workspace');

        const hasGitLab = Boolean(project.gitlab?.repoUrl);

        if (hasGitLab) {
          const gitInfo = await ensureGitWorkspace(project, userId);
          workspacePath = gitInfo.workspacePath;
          mode = 'gitlab';
          source = 'gitlab';
          await markEditJobStatus(jobId, 'running', {
            workspacePath,
            baseCommitSha: gitInfo.headSha,
          });
        } else {
          let wp = project.codeWorkspace?.workspacePath;
          if (!wp || project.codeWorkspace?.status !== 'ready') {
            const result = await createProjectWorkspace(project);
            wp = result.workspacePath;
            await WebsiteProject.updateOne(
              { _id: projectId },
              {
                $set: {
                  'codeWorkspace.status': 'ready',
                  'codeWorkspace.workspacePath': wp,
                  'codeWorkspace.version': result.version,
                  'codeWorkspace.source': 'generated',
                },
              }
            );
          }
          workspacePath = wp;
          mode = 'static';
          source = 'generated';
          await markEditJobStatus(jobId, 'running', { workspacePath });
        }

        await appendEditJobLog(jobId, 'workspace_prepare_done', 'Workspace ready', {
          workspacePath,
          source,
        });
        emit('step', { id: 'loading', label: 'Loading your website draft', status: 'completed' });

        beforeHashes = await computeHashes(workspacePath, source);

        await appendEditJobLog(jobId, 'snapshot_created', 'Creating snapshot');
        snapshotPath = await createDirectorySnapshot(workspacePath, projectId);
        if (snapshotPath) {
          await markEditJobStatus(jobId, 'running', { snapshotPath });
          await appendEditJobLog(jobId, 'snapshot_created', 'Snapshot saved', { snapshotPath });
        } else {
          await appendEditJobLog(jobId, 'snapshot_created', 'Snapshot skipped (non-fatal)');
        }

        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'active' });
        await appendEditJobLog(jobId, 'agent_started', 'Running code agent', { agent: 'ts' });

        const agentResult = await runWebsiteEdit(
          {
            workspacePath,
            ownerMessage: message,
            projectId,
            mode,
            attachments,
          },
          (stepEvent) => {
            emit('step', {
              id: stepEvent.id,
              label: stepEvent.label,
              status: stepEvent.status,
            });
          }
        );

        if (agentResult.rawOutput) {
          await appendEditJobLog(jobId, 'agent_stdout', 'Agent output', {
            excerpt: agentResult.rawOutput.slice(0, 2000),
          });
        }

        if (!agentResult.ok) {
          await appendEditJobLog(jobId, 'agent_finished', 'Agent failed', { error: agentResult.error });
          const kept = await keepPartialChanges(agentResult.summary || 'Partial edit');
          emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
          await fail(
            kept
              ? 'Edit did not finish cleanly, but your local preview changes were kept. Use Force sync to GitLab to save them.'
              : agentResult.error || "I couldn't apply that change. Please try again."
          );
          return;
        }

        await appendEditJobLog(jobId, 'agent_finished', 'Agent completed', {
          summary: agentResult.summary,
          agent: agentResult.agent,
        });
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'completed' });
        emit('step', { id: 'validate', label: 'Checking the preview', status: 'active' });

        const afterHashes = await computeHashes(workspacePath, source);
        const changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);
        const blockedChanged = changedPaths.filter((f) => isBlockedPath(f));

        if (blockedChanged.length > 0) {
          await appendEditJobLog(jobId, 'blocked_file_detected', 'Blocked paths modified', {
            paths: blockedChanged,
          });
          if (snapshotPath) {
            await appendEditJobLog(jobId, 'rollback_started', 'Rolling back blocked file changes');
            await restoreDirectorySnapshot(workspacePath, snapshotPath);
            await appendEditJobLog(jobId, 'rollback_done', 'Rollback complete');
          }
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          await fail("I couldn't apply that change safely.");
          return;
        }

        if (changedPaths.length === 0) {
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          await fail("I couldn't detect any changes from that request.");
          return;
        }

        const changedFiles = await buildChangedFileDetails(
          workspacePath,
          beforeHashes,
          afterHashes,
          snapshotPath
        );
        await attachChangedFiles(jobId, changedFiles);

        await markEditJobStatus(jobId, 'validating');
        await appendEditJobLog(jobId, 'validation_started', 'Running workspace validation');

        const validation = await validateWorkspace(workspacePath, { changedFiles: changedPaths });

        if (!validation.ok) {
          await appendEditJobLog(jobId, 'validation_failed', validation.errors.join('; '), {
            warnings: validation.warnings,
          });
          const kept = await keepPartialChanges(agentResult.summary || 'Edit with validation errors');
          await markEditJobStatus(jobId, 'failed', {
            error: validation.errors[0] || 'Validation failed',
            buildLog: validation.buildLog,
          });
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          const excerpt = validation.buildLog.slice(-1500);
          await fail(
            kept
              ? 'The change broke the build, but local preview files were kept. Fix the issue or use Force sync to GitLab.'
              : 'The change broke the build.',
            excerpt
          );
          return;
        }

        await appendEditJobLog(jobId, 'validation_passed', 'Validation passed', {
          warnings: validation.warnings,
        });

        const newVersion = previewVersionBefore + 1;
        await markEditJobStatus(jobId, 'ready', {
          buildLog: validation.buildLog,
          summary: agentResult.summary || 'Updated your website.',
          previewVersionAfter: newVersion,
        });
        await appendEditJobLog(jobId, 'preview_ready', 'Preview ready', { version: newVersion });

        await WebsiteProject.updateOne(
          { _id: projectId },
          {
            $set: {
              'codeWorkspace.version': newVersion,
              'codeWorkspace.lastEditedAt': new Date(),
              'codeWorkspace.lastEditSummary': agentResult.summary || '',
              'codeWorkspace.lastValidationStatus': 'passed',
              'codeWorkspace.source': source,
              'codeWorkspace.status': 'ready',
              'codeWorkspace.workspacePath': workspacePath,
              hasUnpublishedChanges: true,
              editingMode: 'code',
            },
          }
        );

        emit('step', { id: 'validate', label: 'Checking the preview', status: 'completed' });
        emit('step', { id: 'finish', label: 'Preview updated', status: 'completed' });
        emit('done', {
          ok: true,
          jobId,
          result: {
            ok: true,
            jobId,
            ownerMessage: agentResult.summary || 'Updated your website.',
            changedFiles: changedPaths,
            version: newVersion,
          },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        if (jobId && workspacePath) {
          const kept = await keepPartialChanges('Edit interrupted');
          if (kept) {
            await appendEditJobLog(jobId, 'partial_changes_kept', 'Preserved workspace after error');
          }
        }
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
        const ownerMessage =
          errMsg.includes('Controller is already closed') ||
          errMsg.includes('Invalid state')
            ? 'The edit connection closed early. Your preview may still have the changes — use Force sync on the Changes tab to save them to GitLab.'
            : "I couldn't apply that change. Please try again.";
        await fail(ownerMessage, errMsg);
        return;
      }

      closeStream();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
