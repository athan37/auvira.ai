/**
 * Owner website editing — TypeScript WebsiteEditAgent + validation + ProjectEditJob.
 * Save commits local changes to GitLab. Deploy is handled by /code-agent/deploy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { repairPreviewWorkspace } from '@/lib/preview/repairPreviewWorkspace';
import { repairPreviewSandbox } from '@/lib/sandbox/repairPreviewSandbox';
import { restartSandboxDevServer } from '@/lib/sandbox/sandboxDevServer';
import { checkPreviewHealthy } from '@/lib/project-workspace/bootstrapProjectPreview';
import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteProject } from '@/models/WebsiteProject';
import { createProjectWorkspace } from '@/lib/project-workspace/createProjectWorkspace';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import { resolveWorkspaceForEdit } from '@/lib/project-workspace/resolveWorkspaceGateway';
import { LocalFsGateway, type WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';
import { validateSandboxWorkspace } from '@/lib/sandbox/validateSandboxWorkspace';
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
  logEditFailureTrace,
} from '@/lib/project-workspace/editJobLogger';
import {
  buildEditFailureReport,
  type EditFailureStage,
} from '@/lib/project-workspace/editFailureDetail';
import { resolveEditPreviewVerification } from '@/lib/project-workspace/verifyPreviewForPrompt';
import { resolveSiteWorkspace } from '@/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
import {
  EditStepTimer,
  appendTimedEditJobLog,
  logEditTimingSummary,
} from '@/lib/project-workspace/editTiming';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

async function computeHashes(
  gateway: WorkspaceGateway,
  source: 'gitlab' | 'generated'
) {
  return source === 'gitlab'
    ? gateway.computeHashes()
    : computeStaticWorkspaceHashes(gateway.getWorkspacePath());
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  await connectMongoDB();

  const projectId = params.projectId;
  const project = await getOwnerProject(projectId);
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const sessionUserId = await getServerUserId();
  const userId = sessionUserId ?? project.ownerId?.toString() ?? '';
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
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
      let gateway: WorkspaceGateway | null = null;
      let source: 'gitlab' | 'generated' = 'generated';
      let mode: 'gitlab' | 'static' = 'static';
      let isSandbox = false;
      let beforeHashes: Record<string, string> = {};
      const editTimer = new EditStepTimer();

      type FailOptions = {
        stage: EditFailureStage;
        technicalMessage?: string;
        error?: unknown;
        hasPartialChanges?: boolean;
        extra?: Record<string, unknown>;
      };

      const baseEditContext = (): Record<string, unknown> => ({
        sandbox: isSandbox,
        mode,
        source,
        workspacePath: workspacePath || null,
        attachmentCount: attachments.length,
        promptExcerpt: message.slice(0, 400),
        previewVersionBefore,
      });

      const fail = async (ownerMessage: string, options: FailOptions) => {
        const report = buildEditFailureReport({
          jobId: jobId || 'unknown',
          projectId,
          stage: options.stage,
          ownerMessage,
          technicalMessage: options.technicalMessage,
          error: options.error,
          context: { ...baseEditContext(), ...options.extra },
        });

        if (jobId) {
          await markEditJobStatus(jobId, 'failed', { error: ownerMessage });
          await logEditFailureTrace(jobId, report);
          await logEditTimingSummary(jobId, editTimer).catch(() => {});
        }

        emit('done', {
          ok: false,
          jobId,
          result: {
            ok: false,
            ownerMessage,
            jobId,
            hasPartialChanges: options.hasPartialChanges ?? false,
            errorTrace: report.copyText,
            errorStage: options.stage,
          },
        });
        closeStream();
      };

      const keepPartialChanges = async (summary: string) => {
        if (!jobId || !workspacePath) return false;
        if (!gateway) return false;
        const afterHashes = await computeHashes(gateway, source);
        const changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes).filter(
          (f) => !isBlockedPath(f)
        );
        if (changedPaths.length === 0) return false;

        const changedFiles = await buildChangedFileDetails(
          workspacePath,
          beforeHashes,
          afterHashes,
          snapshotPath,
          isSandbox
            ? {
                readRelFile: async (rel) => {
                  try {
                    return await gateway!.readFile(rel);
                  } catch {
                    return null;
                  }
                },
              }
            : undefined
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
        editTimer.start('workspace_prepare');

        const hasGitLab = Boolean(project.gitlab?.repoUrl);

        if (hasGitLab) {
          const resolved = await resolveWorkspaceForEdit(project, userId);
          gateway = resolved.gateway;
          workspacePath = resolved.workspacePath;
          mode = resolved.mode;
          source = resolved.source;
          isSandbox = resolved.sandbox;
          await markEditJobStatus(jobId, 'running', { workspacePath });
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
          gateway = new LocalFsGateway(workspacePath);
          await markEditJobStatus(jobId, 'running', { workspacePath });
        }

        if (!gateway) {
          throw new Error('Workspace gateway not initialized');
        }

        await appendTimedEditJobLog(
          jobId,
          'workspace_prepare_done',
          'Workspace ready',
          editTimer.finish('workspace_prepare'),
          { workspacePath, source, sandbox: isSandbox, phase: 'workspace_prepare' }
        );
        emit('step', { id: 'loading', label: 'Loading your website draft', status: 'completed' });

        beforeHashes = await computeHashes(gateway, source);

        if (!isSandbox) {
          await appendEditJobLog(jobId, 'snapshot_created', 'Creating snapshot');
          snapshotPath = await createDirectorySnapshot(workspacePath, projectId);
        } else {
          await appendEditJobLog(jobId, 'snapshot_created', 'Snapshot skipped (sandbox VM)');
        }
        if (snapshotPath) {
          await markEditJobStatus(jobId, 'running', { snapshotPath });
          await appendEditJobLog(jobId, 'snapshot_created', 'Snapshot saved', { snapshotPath });
        } else {
          await appendEditJobLog(jobId, 'snapshot_created', 'Snapshot skipped (non-fatal)');
        }

        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'active' });
        editTimer.start('agent');
        await appendEditJobLog(jobId, 'agent_started', 'Running code agent', { agent: 'ts' });

        const agentResult = await runWebsiteEdit(
          {
            workspacePath,
            ownerMessage: message,
            projectId,
            mode,
            attachments,
            gateway,
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
          await appendTimedEditJobLog(
            jobId,
            'agent_finished',
            'Agent failed',
            editTimer.finish('agent'),
            {
              error: agentResult.error,
              strategy: agentResult.strategy,
              agent: agentResult.agent,
              changedFiles: agentResult.changedFiles,
              phase: 'agent',
            }
          );
          const kept = await keepPartialChanges(agentResult.summary || 'Partial edit');
          emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
          await fail(
            kept
              ? "That edit didn't finish. Your preview may show unsaved local changes — open the Changes tab when you want to review or sync."
              : agentResult.ownerMessage ||
                  agentResult.error ||
                  "I couldn't apply that change. Please try again.",
            {
              stage: 'agent_failed',
              technicalMessage: agentResult.error,
              hasPartialChanges: kept,
              extra: {
                strategy: agentResult.strategy,
                agent: agentResult.agent,
                changedFiles: agentResult.changedFiles,
                agentOwnerMessage: agentResult.ownerMessage,
              },
            }
          );
          return;
        }

        await appendTimedEditJobLog(
          jobId,
          'agent_finished',
          'Agent completed',
          editTimer.finish('agent'),
          { summary: agentResult.summary, agent: agentResult.agent, strategy: agentResult.strategy, phase: 'agent' }
        );
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'completed' });
        emit('step', { id: 'validate', label: 'Checking the preview', status: 'active' });

        if (mode === 'gitlab' && isSandbox) {
          try {
            await repairPreviewSandbox(projectId);
            await appendEditJobLog(jobId, 'workspace_repaired', 'Applied preview-safe repairs (sandbox)');
          } catch (repairErr) {
            const msg = repairErr instanceof Error ? repairErr.message : String(repairErr);
            await appendEditJobLog(jobId, 'workspace_repair_skipped', msg);
          }
        } else if (mode === 'gitlab' && workspacePath) {
          await repairPreviewWorkspace(workspacePath);
          await appendEditJobLog(jobId, 'workspace_repaired', 'Applied preview-safe repairs');
        }

        const afterHashes = await computeHashes(gateway, source);
        const changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);
        const blockedChanged = changedPaths.filter((f) => isBlockedPath(f));

        if (blockedChanged.length > 0) {
          await appendEditJobLog(jobId, 'blocked_file_detected', 'Blocked paths modified', {
            paths: blockedChanged,
          });
          if (snapshotPath && !isSandbox) {
            await appendEditJobLog(jobId, 'rollback_started', 'Rolling back blocked file changes');
            await restoreDirectorySnapshot(workspacePath, snapshotPath);
            await appendEditJobLog(jobId, 'rollback_done', 'Rollback complete');
          }
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
          await fail("I couldn't apply that change safely.", {
            stage: 'blocked_paths',
            extra: { blockedPaths: blockedChanged },
          });
          return;
        }

        if (changedPaths.length === 0) {
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
          await fail("I couldn't detect any changes from that request.", {
            stage: 'no_changes',
          });
          return;
        }

        if (attachments.length > 0) {
          const imageContentChanged =
            mode === 'static'
              ? changedPaths.some((p) => p === 'index.html' || p === 'site.json')
              : changedPaths.some((p) => p.includes('siteConfig') || p.includes('page.tsx'));
          if (!imageContentChanged) {
            emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
            emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
            emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
            await fail(
              'Images were uploaded, but your homepage content was not updated. Please try again.',
              {
                stage: 'agent_failed',
                technicalMessage:
                  mode === 'static'
                    ? 'No index.html or site.json change after edit with attachments'
                    : 'No siteConfig.ts or page.tsx change after edit with attachments',
                extra: {
                  strategy: agentResult.strategy,
                  changedPaths,
                  attachmentCount: attachments.length,
                  mode,
                },
              }
            );
            return;
          }
        }

        const activeGateway = gateway;
        const changedFiles = await buildChangedFileDetails(
          workspacePath,
          beforeHashes,
          afterHashes,
          snapshotPath,
          isSandbox && activeGateway
            ? {
                readRelFile: async (rel) => {
                  try {
                    return await activeGateway.readFile(rel);
                  } catch {
                    return null;
                  }
                },
              }
            : undefined
        );
        await attachChangedFiles(jobId, changedFiles);

        await markEditJobStatus(jobId, 'validating');
        editTimer.start('validation');
        await appendEditJobLog(jobId, 'validation_started', 'Running workspace validation');

        const validation = isSandbox
          ? await validateSandboxWorkspace(projectId, changedPaths)
          : await validateWorkspace(workspacePath, { changedFiles: changedPaths });

        if (!validation.ok) {
          await appendTimedEditJobLog(
            jobId,
            'validation_failed',
            validation.errors.join('; '),
            editTimer.finish('validation'),
            { warnings: validation.warnings, phase: 'validation' }
          );
          const kept = await keepPartialChanges(agentResult.summary || 'Edit with validation errors');
          await markEditJobStatus(jobId, 'failed', {
            error: validation.errors[0] || 'Validation failed',
            buildLog: validation.buildLog,
          });
          emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
          emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
          const excerpt = validation.buildLog.slice(-1500);
          await fail(
            kept
              ? "That edit broke the preview build. Unsaved local changes may still be visible — open the Changes tab to review or sync when ready."
              : 'The change broke the build.',
            {
              stage: 'validation_failed',
              technicalMessage: validation.errors.join('; ') || excerpt,
              hasPartialChanges: kept,
              extra: {
                validationErrors: validation.errors,
                validationWarnings: validation.warnings,
                buildLogExcerpt: excerpt,
                changedPaths,
              },
            }
          );
          return;
        }

        await appendTimedEditJobLog(
          jobId,
          'validation_passed',
          'Validation passed',
          editTimer.finish('validation'),
          { warnings: validation.warnings, phase: 'validation' }
        );

        let sandboxPreviewUrl: string | null = null;
        if (isSandbox) {
          emit('step', { id: 'validate', label: 'Restarting preview server', status: 'active' });
          editTimer.start('preview_restart');
          await appendEditJobLog(jobId, 'preview_restart_started', 'Restarting sandbox dev server');
          try {
            sandboxPreviewUrl = await restartSandboxDevServer(projectId);
            await appendTimedEditJobLog(
              jobId,
              'preview_restarted',
              'Sandbox dev server restarted',
              editTimer.finish('preview_restart'),
              { previewUrl: sandboxPreviewUrl, phase: 'preview_restart' }
            );
          } catch (restartErr) {
            const msg = restartErr instanceof Error ? restartErr.message : String(restartErr);
            await appendTimedEditJobLog(
              jobId,
              'preview_restart_failed',
              msg,
              editTimer.finish('preview_restart'),
              { phase: 'preview_restart' }
            );
            emit('step', { id: 'validate', label: 'Restarting preview server', status: 'failed' });
            await fail(
              'Your changes were saved, but the preview server needs a refresh. Close and reopen the project, or try your edit again.',
              {
                stage: 'preview_restart_failed',
                technicalMessage: msg,
                error: restartErr,
              }
            );
            return;
          }
          emit('step', { id: 'validate', label: 'Restarting preview server', status: 'completed' });
        }

        const previewPort = project.preview?.port;
        if (previewPort && !isSandbox) {
          editTimer.start('preview_health');
          await new Promise((r) => setTimeout(r, 1500));
          const previewHealthy = await checkPreviewHealthy(previewPort, 12_000);
          await appendTimedEditJobLog(
            jobId,
            previewHealthy ? 'preview_health_ok' : 'preview_health_slow',
            previewHealthy ? 'Preview dev server healthy' : 'Preview may need a manual refresh',
            editTimer.finish('preview_health'),
            { port: previewPort, phase: 'preview_health' }
          );
        }

        const newVersion = previewVersionBefore + 1;
        await markEditJobStatus(jobId, 'ready', {
          buildLog: validation.buildLog,
          summary: agentResult.summary || 'Updated your website.',
          previewVersionAfter: newVersion,
        });
        await appendEditJobLog(jobId, 'preview_ready', 'Preview ready', { version: newVersion });

        const previewUrlForVerify =
          sandboxPreviewUrl ||
          (previewPort && !isSandbox ? `http://127.0.0.1:${previewPort}` : null) ||
          project.preview?.url?.trim() ||
          null;

        let previewVerify = { ok: true, reason: 'skipped', imagesFound: 0, htmlLength: 0 };
        if (previewUrlForVerify && changedPaths.length > 0) {
          emit('step', {
            id: 'validate',
            label: 'Confirming changes appear in preview',
            status: 'active',
          });
          editTimer.start('preview_verify');
          await appendEditJobLog(jobId, 'preview_verify_started', 'Verifying preview content');
          let workspaceSnap;
          if (activeGateway && workspacePath) {
            workspaceSnap = await resolveSiteWorkspace({
              workspacePath,
              mode,
              gateway: activeGateway,
            });
          } else if (workspacePath && mode === 'static') {
            workspaceSnap = await resolveSiteWorkspace({
              workspacePath,
              mode: 'static',
            });
          }
          previewVerify = await resolveEditPreviewVerification({
            previewUrl: previewUrlForVerify,
            ownerMessage: message,
            attachments,
            isSandbox,
            mode,
            workspaceSnap,
            gateway: activeGateway ?? undefined,
          });
          await appendTimedEditJobLog(
            jobId,
            previewVerify.ok ? 'preview_content_verified' : 'preview_content_missing',
            previewVerify.reason,
            editTimer.finish('preview_verify'),
            {
              previewUrl: previewUrlForVerify,
              imagesFound: previewVerify.imagesFound,
              htmlLength: previewVerify.htmlLength,
              phase: 'preview_verify',
            }
          );
          if (!previewVerify.ok) {
            const kept = await keepPartialChanges(agentResult.summary || 'Preview verify failed');
            emit('step', {
              id: 'validate',
              label: 'Confirming changes appear in preview',
              status: 'failed',
            });
            emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
            const userMsg =
              attachments.length > 0
                ? kept
                  ? 'Images were uploaded and site files changed, but the preview still does not show your new section. Use Refresh on the preview or try the edit again.'
                  : 'Images were uploaded, but the preview does not show your new product section yet. Please try the edit again.'
                : kept
                  ? 'Your changes were saved, but the preview does not reflect your request yet. Use Refresh on the preview or try the edit again.'
                  : 'The preview does not show your requested change yet. Please try the edit again.';
            await fail(userMsg, {
              stage: 'agent_failed',
              technicalMessage: previewVerify.reason,
              hasPartialChanges: kept,
              extra: {
                previewUrl: previewUrlForVerify,
                strategy: agentResult.strategy,
                changedPaths,
              },
            });
            return;
          }
        }

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
              'codeWorkspace.sandboxWorkspace': isSandbox,
              hasUnpublishedChanges: true,
              editingMode: 'code',
              ...(sandboxPreviewUrl
                ? {
                    'preview.url': sandboxPreviewUrl,
                    'preview.status': 'ready',
                    'preview.previewMode': 'sandbox',
                  }
                : {}),
            },
          }
        );

        const successOwnerMessage =
          attachments.length > 0 && previewVerify.imagesFound > 0
            ? `Added your product section with ${previewVerify.imagesFound} image(s) in the preview. Scroll just below the hero to see it.`
            : agentResult.ownerMessage || agentResult.summary || 'Updated your website.';

        await logEditTimingSummary(jobId, editTimer);
        const timingSummary = editTimer.summary();
        const slowest = editTimer.slowest();

        emit('step', { id: 'validate', label: 'Checking the preview', status: 'completed' });
        emit('step', { id: 'finish', label: 'Preview updated', status: 'completed' });
        emit('done', {
          ok: true,
          jobId,
          result: {
            ok: true,
            jobId,
            ownerMessage: successOwnerMessage,
            previewVerified: previewVerify.ok,
            changedFiles: changedPaths,
            version: newVersion,
            timing: {
              totalMs: editTimer.totalMs(),
              phases: timingSummary,
              slowestPhase: slowest?.phase,
              slowestMs: slowest?.durationMs,
            },
          },
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        let kept = false;
        if (jobId && workspacePath) {
          kept = await keepPartialChanges('Edit interrupted');
          if (kept) {
            await appendEditJobLog(jobId, 'partial_changes_kept', 'Preserved workspace after error');
          }
        }
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
        emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
        emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
        const sandboxWriteFailed = errMsg.includes('Status code 400 is not ok');
        const ownerMessage =
          errMsg.includes('Controller is already closed') ||
          errMsg.includes('Invalid state')
            ? "The edit connection closed early. Your preview may still have local changes — open the Changes tab if you need to review or sync."
            : sandboxWriteFailed
              ? "The preview environment couldn't save your changes (sandbox write error). Please try the edit again; if it keeps failing, refresh the page to restart preview."
              : kept
                ? "The edit stopped early. Your preview may still have local changes — open the Changes tab if you need to review or sync."
                : "I couldn't apply that change. Please try again.";
        await fail(ownerMessage, {
          stage: 'unexpected_error',
          technicalMessage: errMsg,
          error,
          hasPartialChanges: kept,
          extra: {
            sandboxWriteFailed: errMsg.includes('Status code 400 is not ok'),
          },
        });
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
