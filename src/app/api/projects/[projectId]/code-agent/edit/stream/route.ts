/**
 * Owner website editing — TypeScript WebsiteEditAgent + validation + ProjectEditJob.
 * Save commits local changes to GitLab. Deploy is handled by /code-agent/deploy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { repairPreviewWorkspace } from '@/lib/preview/repairPreviewWorkspace';
import { restartSandboxDevServer, shouldRestartSandboxDevServer } from '@/lib/sandbox/sandboxDevServer';
import { checkPreviewHealthy } from '@/lib/project-workspace/bootstrapProjectPreview';
import { connectMongoDB } from '@/lib/mongodb';
import {
  LEGACY_PROJECT_UNSUPPORTED_MESSAGE,
  projectSupportsV3Edits,
} from '@/lib/project-workspace/requireGitLabProject';
import { WebsiteProject } from '@/models/WebsiteProject';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { resolveWorkspaceForEdit } from '@/lib/project-workspace/resolveWorkspaceGateway';
import { type WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';
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
import {
  resolveEditPreviewVerification,
  type VerifyPreviewResult,
} from '@/lib/project-workspace/verifyPreviewForPrompt';
import { resolveEditStreamPreviewOutcome } from '@/lib/project-workspace/previewStability';
import { workspaceEditNeedsPreviewReload } from '@/lib/project-workspace/previewReloadAfterEdit';
import {
  resolveExpectedPreviewPresentationClasses,
  waitForPresentationClassInPreview,
} from '@/lib/project-workspace/previewReflectsSiteConfig';
import { enforceSectionColorEditReadyAfterApply, findSectionIndexWithBackgroundClassChange } from '@/lib/project-workspace/sectionPresentationEdit';
import { isInfraBaselineReady } from '@/lib/project-workspace/infra/isInfraBaselineReady';
import { resolveSiteWorkspace } from '@/lib/project-workspace/edit-shared/resolveSiteWorkspace';
import {
  appendAssistantMessage,
  appendUserMessage,
  buildConversationHistory,
  resolveEditFocusFromProject,
  resolveLastGalleryEditForProject,
} from '@/lib/chat/projectChatService';
import {
  EditStepTimer,
  appendTimedEditJobLog,
  logEditTimingSummary,
} from '@/lib/project-workspace/editTiming';
import { migrateSubtitleStyleMarkersInSource } from '@/lib/project-workspace/siteConfigMutations';
import { detectCopyEditAlreadyApplied } from '@/lib/project-workspace/edit-context/detectCopyEditAlreadyApplied';
import { tryDeterministicCopyFallback } from '@/lib/project-workspace/edit-context/tryDeterministicCopyFallback';
import { ProjectEditJob } from '@/models/ProjectEditJob';
import {
  ensureObservabilityRegistration,
  fetchCoachingContext,
  isObservabilityCoachingEnabled,
  isObservabilityEnabled,
  loadSiteConfigForObservability,
  recordEditTurn,
} from '@/lib/observability';
import type {
  ObservabilityCoachingContext,
  ObservabilityEditOutcome,
  ObservabilityTurnMetadata,
} from '@/lib/observability/types';
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

  if (!projectSupportsV3Edits(project)) {
    return NextResponse.json({ detail: LEGACY_PROJECT_UNSUPPORTED_MESSAGE }, { status: 409 });
  }

  const body = await request.json();
  const { message, attachments: rawAttachments, clientMessageId, selectedTarget: rawSelectedTarget } = body;
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ detail: 'message is required' }, { status: 400 });
  }

  const selectedTarget = normalizeSelectedTarget(rawSelectedTarget);

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
      let source: 'gitlab' | 'generated' = 'gitlab';
      let mode: 'gitlab' = 'gitlab';
      let isSandbox = false;
      let beforeHashes: Record<string, string> = {};
      const editTimer = new EditStepTimer();
      let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
      let coachingContext: ObservabilityCoachingContext | null = null;
      let turnIndex = 0;

      const targetSectionLabel =
        selectedTarget?.sectionTitle ??
        selectedTarget?.elementLabel ??
        selectedTarget?.targetChain?.find((node) => node.role === 'section')?.label ??
        null;

      async function recordObservabilityTurnForEdit(args: {
        outcome: ObservabilityEditOutcome;
        reply: string;
        verifyPass?: boolean;
        buildGatePass?: boolean;
        changedFiles?: string[];
        needsClarification?: boolean;
        siteConfigParsed?: {
          businessName?: string;
          sections?: Array<{ type?: string; title?: string; items?: unknown[] }>;
        } | null;
      }): Promise<ObservabilityTurnMetadata | null> {
        if (!isObservabilityEnabled() || !jobId) return null;
        try {
          return await recordEditTurn({
            projectId,
            turnId: jobId,
            turnIndex,
            userMessage: message,
            reply: args.reply,
            outcome: args.outcome,
            verifyPass: args.verifyPass,
            buildGatePass: args.buildGatePass,
            changedFiles: args.changedFiles,
            siteConfigParsed: args.siteConfigParsed ?? null,
            editTimer,
            targetSection: targetSectionLabel,
            needsClarification: args.needsClarification,
            coachingContext,
          });
        } catch {
          return null;
        }
      }

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
        const observabilityMeta = await recordObservabilityTurnForEdit({
          outcome: 'failed',
          reply: ownerMessage,
          changedFiles: Array.isArray(options.extra?.changedPaths)
            ? options.extra.changedPaths.map(String)
            : undefined,
          buildGatePass:
            typeof options.extra?.buildGatePass === 'boolean'
              ? options.extra.buildGatePass
              : undefined,
          verifyPass:
            typeof options.extra?.verifyPass === 'boolean'
              ? options.extra.verifyPass
              : undefined,
        });
        await appendAssistantMessage({
          projectId: project._id,
          content: ownerMessage,
          metadata: {
            editJobId: jobId || undefined,
            outcome: 'failure',
            errorStage: options.stage,
            errorTraceExcerpt: report.copyText.slice(0, 8000),
            changedFiles: Array.isArray(options.extra?.changedPaths)
              ? options.extra.changedPaths.map(String)
              : undefined,
            timing: {
              totalMs: editTimer.totalMs(),
              phases: editTimer.summary(),
              slowestPhase: editTimer.slowest()?.phase,
              slowestMs: editTimer.slowest()?.durationMs,
            },
            arize: observabilityMeta?.arize ?? { syncStatus: 'pending' },
            observability: observabilityMeta?.observability,
          },
        }).catch(() => {});

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
        if (isObservabilityEnabled()) {
          turnIndex = await ProjectEditJob.countDocuments({ projectId: project._id });
        }
        await appendUserMessage({
          projectId: project._id,
          content: message,
          attachments,
          clientMessageId: typeof clientMessageId === 'string' ? clientMessageId : undefined,
          selectedTarget,
        });
        conversationHistory = await buildConversationHistory({
          projectId: project._id,
          maxTurns: 8,
        });
        const editFocusStack = await resolveEditFocusFromProject({
          projectId: project._id,
        });
        const lastGalleryEdit = await resolveLastGalleryEditForProject({
          projectId: project._id,
        });
        emit('step', { id: 'loading', label: 'Loading your website draft', status: 'active', jobId });

        await appendEditJobLog(jobId, 'workspace_prepare_started', 'Preparing workspace');
        editTimer.start('workspace_prepare');

        const resolved = await resolveWorkspaceForEdit(project, userId);
        gateway = resolved.gateway;
        workspacePath = resolved.workspacePath;
        mode = 'gitlab';
        source = resolved.source;
        isSandbox = resolved.sandbox;
        await markEditJobStatus(jobId, 'running', { workspacePath });

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

        if (isObservabilityEnabled()) {
          await ensureObservabilityRegistration({
            projectId,
            title: project.name || 'Untitled project',
          });
          coachingContext = await fetchCoachingContext({ projectId, userMessage: message });
          await appendEditJobLog(jobId, 'observability_context', 'Fetched monitor context', {
            hintCount: coachingContext?.coachingHints.length ?? 0,
            source: coachingContext?.source ?? 'none',
            recurringIssues: coachingContext?.recurringIssues ?? [],
            coachingInjected: isObservabilityCoachingEnabled(),
          });
        }

        const agentResult = await runWebsiteEdit(
          {
          workspacePath,
          ownerMessage: message,
          projectId,
          mode,
            attachments,
            gateway,
            conversationHistory,
            lastGalleryEdit: lastGalleryEdit ?? undefined,
            editFocusStack,
            selectedTarget,
            editJobId: jobId,
            infraStatus: project.infraStatus,
            infraVersion: project.infraVersion,
            coachingContext: isObservabilityCoachingEnabled() ? coachingContext : undefined,
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
          if (agentResult.needsClarification) {
            await appendTimedEditJobLog(
              jobId,
              'needs_clarification',
              'Awaiting owner clarification',
              editTimer.finish('agent'),
              {
                strategy: agentResult.strategy,
                phase: 'agent',
              }
            );
            await markEditJobStatus(jobId, 'ready', {
              error: agentResult.ownerMessage || agentResult.error,
            });
            emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'completed' });
            emit('step', { id: 'validate', label: 'Checking the preview', status: 'completed' });
            emit('step', { id: 'finish', label: 'Need a quick detail', status: 'completed' });
            const clarificationReply =
              agentResult.ownerMessage || agentResult.error || 'Need one more detail.';
            const observabilityMeta = await recordObservabilityTurnForEdit({
              outcome: 'clarification',
              reply: clarificationReply,
              needsClarification: true,
            });
            await appendAssistantMessage({
              projectId: project._id,
              content: clarificationReply,
              metadata: {
                editJobId: jobId,
                outcome: 'clarification',
                suggestedReplies: agentResult.suggestedReplies,
                errorStage: 'needs_clarification',
                strategy: agentResult.strategy,
                clarificationAnchor: agentResult.clarificationAnchor,
                ...(agentResult.clarificationAnchor?.kind === 'hero'
                  ? {
                      editFocusStack: {
                        items: [
                          {
                            kind: 'hero' as const,
                            sectionIndex: -1,
                            sectionTitle: 'Hero',
                            sectionType: 'hero',
                            at: new Date().toISOString(),
                          },
                        ],
                      },
                    }
                  : {}),
                timing: {
                  totalMs: editTimer.totalMs(),
                  phases: editTimer.summary(),
                  slowestPhase: editTimer.slowest()?.phase,
                  slowestMs: editTimer.slowest()?.durationMs,
                },
                arize: observabilityMeta?.arize ?? { syncStatus: 'pending' },
                observability: observabilityMeta?.observability,
              },
            }).catch(() => {});
            emit('done', {
              ok: false,
              jobId,
              result: {
                ok: false,
                jobId,
                needsClarification: true,
                ownerMessage: agentResult.ownerMessage || agentResult.error,
                suggestedReplies: agentResult.suggestedReplies,
                errorStage: 'needs_clarification',
              },
            });
            closeStream();
            return;
          }

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
          {
            summary: agentResult.summary,
            agent: agentResult.agent,
            strategy: agentResult.strategy,
            tier: agentResult.tier,
            confidence: agentResult.confidence,
            verifyProfile: agentResult.verifyProfile,
            phase: 'agent',
          }
        );
        emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'completed' });
        emit('step', { id: 'validate', label: 'Checking the preview', status: 'active' });

        if (mode === 'gitlab' && workspacePath && !isSandbox) {
          await repairPreviewWorkspace(workspacePath);
          await appendEditJobLog(jobId, 'workspace_repaired', 'Applied preview-safe repairs');
        }

        let afterHashes = await computeHashes(gateway, source);
        let changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);

        if (mode === 'gitlab' && changedPaths.includes('src/lib/siteConfig.ts')) {
          try {
            const siteConfigCurrent = await gateway.readFile('src/lib/siteConfig.ts');
            if (siteConfigCurrent) {
              const migrated = migrateSubtitleStyleMarkersInSource(siteConfigCurrent);
              if (migrated && migrated !== siteConfigCurrent) {
                await gateway.writeFile('src/lib/siteConfig.ts', migrated);
                await appendEditJobLog(
                  jobId,
                  'subtitle_style_marker_migrated',
                  'Migrated subtitle style marker to section.presentation'
                );
                afterHashes = await computeHashes(gateway, source);
                changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);
              }
            }
          } catch {
            /* best effort; continue normal flow */
          }
        }
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
          let siteConfigForCheck = '';
          try {
            siteConfigForCheck = (await gateway.readFile('src/lib/siteConfig.ts')) ?? '';
          } catch {
            /* optional */
          }

          const alreadyApplied = siteConfigForCheck
            ? detectCopyEditAlreadyApplied(
                siteConfigForCheck,
                message,
                selectedTarget ?? undefined
              )
            : { applied: false };

          if (alreadyApplied.applied) {
            await appendEditJobLog(jobId, 'edit_already_applied', 'Requested copy already in siteConfig', {
              fieldPath: alreadyApplied.fieldPath,
              expectedValue: alreadyApplied.expectedValue,
            });
            agentResult.summary =
              agentResult.summary ||
              `The ${alreadyApplied.fieldPath ?? 'field'} is already set to "${alreadyApplied.expectedValue}". Refreshing preview.`;
            agentResult.ownerMessage = agentResult.summary;
            changedPaths.push('src/lib/siteConfig.ts');
          } else if ((agentResult.changedFiles?.length ?? 0) > 0) {
            await appendEditJobLog(jobId, 'agent_changed_files_fallback', 'Using agent changedFiles (hash diff empty)', {
              paths: agentResult.changedFiles,
            });
            for (const rel of agentResult.changedFiles ?? []) {
              if (!changedPaths.includes(rel)) changedPaths.push(rel);
            }
          } else {
            const fallback = await tryDeterministicCopyFallback({
              gateway,
              message,
              selectedTarget: selectedTarget ?? undefined,
            });
            if (fallback.applied) {
              await appendEditJobLog(jobId, 'deterministic_copy_fallback', 'Applied deterministic copy fallback', {
                fieldPath: fallback.fieldPath,
                value: fallback.value,
              });
              afterHashes = await computeHashes(gateway, source);
              changedPaths = getChangedPathsFromHashes(beforeHashes, afterHashes);
              if (changedPaths.length === 0) {
                changedPaths.push('src/lib/siteConfig.ts');
              }
            } else {
              emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
              emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
              await fail("I couldn't detect any changes from that request.", {
                stage: 'no_changes',
                extra: {
                  strategy: agentResult.strategy,
                  agentChangedFiles: agentResult.changedFiles,
                  agentSummary: agentResult.summary,
                  selectedTargetPresent: Boolean(selectedTarget),
                  fallbackError: fallback.error,
                },
              });
              return;
            }
          }
        }

        if (attachments.length > 0) {
          const imageContentChanged = changedPaths.some(
            (p) => p.includes('siteConfig') || p.includes('page.tsx')
          );
          if (!imageContentChanged) {
            emit('step', { id: 'apply_change', label: 'Applying your requested change', status: 'failed' });
            emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
            emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
            await fail(
              'Images were uploaded, but your homepage content was not updated. Please try again.',
              {
                stage: 'agent_failed',
                technicalMessage: 'No siteConfig.ts or page.tsx change after edit with attachments',
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

        if (mode === 'gitlab' && agentResult.strategy === 'section_style') {
          editTimer.start('section_color_gate');
          let beforeSiteConfig: string | undefined;
          if (snapshotPath) {
            try {
              beforeSiteConfig = await fs.readFile(
                path.join(snapshotPath, 'src/lib/siteConfig.ts'),
                'utf-8'
              );
            } catch {
              /* snapshot may omit siteConfig on edge cases */
            }
          }
          let afterSiteConfig: string | undefined;
          try {
            afterSiteConfig = (await activeGateway.readFile('src/lib/siteConfig.ts')) ?? undefined;
          } catch {
            /* best effort */
          }
          const colorGate = await enforceSectionColorEditReadyAfterApply({
            workspace: {
              workspacePath,
              gateway: activeGateway ?? undefined,
              ownerMessage: message,
            },
            projectInfraStatus: {
              infraBaselineReady: isInfraBaselineReady({
                infraStatus: project.infraStatus,
                infraVersion: project.infraVersion,
              }),
            },
            strategy: agentResult.strategy,
            ownerMessage: message,
            agentSummary: agentResult.summary,
            beforeSiteConfig,
            sectionIndex:
              beforeSiteConfig && afterSiteConfig
                ? findSectionIndexWithBackgroundClassChange(beforeSiteConfig, afterSiteConfig) ??
                  undefined
                : undefined,
          });
          await appendTimedEditJobLog(
            jobId,
            colorGate.ok ? 'section_color_gate_passed' : 'section_color_gate_failed',
            colorGate.ok
              ? 'Section color invariants satisfied'
              : colorGate.errors.join('; '),
            editTimer.finish('section_color_gate'),
            { retried: colorGate.retried, errors: colorGate.errors }
          );
          if (!colorGate.ok) {
            emit('step', { id: 'validate', label: 'Checking the preview', status: 'failed' });
            emit('step', { id: 'finish', label: 'Preview not updated', status: 'failed' });
            await fail(
              "That section color change didn't fully apply. Please try again.",
              {
                stage: 'validation_failed',
                technicalMessage: colorGate.errors.join('; '),
                extra: {
                  strategy: agentResult.strategy,
                  sectionColorGate: colorGate,
                  changedPaths,
                },
              }
            );
            return;
          }
          if (colorGate.summary) {
            agentResult.summary = colorGate.summary;
            agentResult.ownerMessage = colorGate.summary;
          }
        }

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
                buildGatePass: false,
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
          const needsRestart = shouldRestartSandboxDevServer(changedPaths);
          if (needsRestart) {
            emit('step', { id: 'validate', label: 'Restarting preview server', status: 'active' });
            editTimer.start('preview_restart');
            await appendEditJobLog(jobId, 'preview_restart_started', 'Restarting sandbox dev server');
            try {
              sandboxPreviewUrl = await restartSandboxDevServer(projectId, {
                skipRepair: agentResult.strategy === 'image_gallery',
              });
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
          } else {
            await appendEditJobLog(
              jobId,
              'preview_restart_skipped',
              'Skipped sandbox dev restart (src-only edit; HMR applies changes)',
              { changedPaths }
            );
          }
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

        let siteConfigForVerify: string | undefined;
        if (activeGateway && changedPaths.some((p) => p.includes('siteConfig'))) {
          try {
            siteConfigForVerify =
              (await activeGateway.readFile('src/lib/siteConfig.ts')) ?? undefined;
          } catch {
            siteConfigForVerify = undefined;
          }
        }

        let previewVerify: VerifyPreviewResult = {
          ok: true,
          reason: 'skipped',
          imagesFound: 0,
          htmlLength: 0,
          phraseMatched: false,
        };
        let previewVerifySkipped = true;
        let editStreamOutcome = resolveEditStreamPreviewOutcome({
          sourceValidationPassed: true,
          editApplied: true,
          previewVerify,
          previewVerifySkipped: true,
          defaultSuccessMessage:
            agentResult.ownerMessage || agentResult.summary || 'Updated your website.',
        });
        if (previewUrlForVerify && changedPaths.length > 0) {
          previewVerifySkipped = false;
          emit('step', {
            id: 'validate',
            label: 'Confirming changes appear in preview',
            status: 'active',
          });
          editTimer.start('preview_verify');
          await appendEditJobLog(jobId, 'preview_verify_started', 'Verifying preview content');
          let workspaceSnap;
          if (workspacePath) {
            workspaceSnap = await resolveSiteWorkspace({
              workspacePath,
              mode: 'gitlab',
              gateway: activeGateway ?? undefined,
            });
          }
          previewVerify = await resolveEditPreviewVerification({
            previewUrl: previewUrlForVerify,
            projectId,
            ownerMessage: message,
            attachments,
            isSandbox,
            mode,
            workspaceSnap,
            gateway: activeGateway ?? undefined,
            siteConfigContent: siteConfigForVerify,
            pageContent: workspaceSnap?.pageContent ?? undefined,
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
          editStreamOutcome = resolveEditStreamPreviewOutcome({
            sourceValidationPassed: true,
            editApplied: true,
            previewVerify,
            previewVerifySkipped: false,
            defaultSuccessMessage:
              attachments.length > 0 && previewVerify.imagesFound > 0
                ? `Added your product section with ${previewVerify.imagesFound} image(s) in the preview. Scroll just below the hero to see it.`
                : agentResult.ownerMessage || agentResult.summary || 'Updated your website.',
          });
          if (!previewVerify.ok) {
            await appendEditJobLog(
              jobId,
              'preview_verify_soft_pass',
              'Preview not synced; source edit saved',
              {
                reason: previewVerify.reason,
                previewUrl: previewUrlForVerify,
                changedPaths,
                previewVerifyStatus: editStreamOutcome.previewVerifyStatus,
              }
            );
            emit('step', {
              id: 'validate',
              label: 'Confirming changes appear in preview',
              status: 'completed',
            });
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

        if (
          !isSandbox &&
          workspaceEditNeedsPreviewReload(changedPaths) &&
          editStreamOutcome.editApplied &&
          previewUrlForVerify
        ) {
          let siteConfigSettle: string | undefined = siteConfigForVerify;
          if (!siteConfigSettle && activeGateway) {
            try {
              siteConfigSettle =
                (await activeGateway.readFile('src/lib/siteConfig.ts')) ?? undefined;
            } catch {
              siteConfigSettle = undefined;
            }
          }
          const expectedClasses = resolveExpectedPreviewPresentationClasses(
            siteConfigSettle,
            message
          );
          if (expectedClasses.length > 0) {
            if (previewVerify.presentationClassPolled) {
              await appendEditJobLog(
                jobId,
                editStreamOutcome.previewSynced
                  ? 'preview_presentation_synced'
                  : 'preview_presentation_pending',
                previewVerify.reason,
                { expectedClasses, alreadyPolled: true }
              );
            } else {
              await appendEditJobLog(
                jobId,
                'preview_compile_settle',
                'Waiting for preview HTML to include saved presentation classes',
                { expectedClasses }
              );
              const sync = await waitForPresentationClassInPreview(
                previewUrlForVerify,
                expectedClasses,
                { retries: 6, delayMs: 1_000 }
              );
              await appendEditJobLog(
                jobId,
                sync.ok ? 'preview_presentation_synced' : 'preview_presentation_pending',
                sync.reason,
                { expectedClasses }
              );
              if (!sync.ok && editStreamOutcome.previewSynced) {
                editStreamOutcome = {
                  ...editStreamOutcome,
                  previewSynced: false,
                  previewVerifyStatus: 'pending',
                  previewVerifyReason: sync.reason,
                  ownerMessage:
                    'Saved. Preview is still syncing; refresh in a moment.',
                };
              }
            }
          } else {
            await new Promise((r) => setTimeout(r, 2_000));
          }
        }

        const successOwnerMessage = editStreamOutcome.ownerMessage;
        const finishLabel = editStreamOutcome.previewSynced
          ? 'Preview updated'
          : 'Saved — preview syncing';

        await logEditTimingSummary(jobId, editTimer);
        const timingSummary = editTimer.summary();
        const slowest = editTimer.slowest();
        const siteConfigParsed = workspacePath
          ? await loadSiteConfigForObservability({ workspacePath, gateway: gateway ?? undefined })
          : null;
        const observabilityMeta = await recordObservabilityTurnForEdit({
          outcome: 'success',
          reply: successOwnerMessage,
          verifyPass: editStreamOutcome.previewSynced,
          buildGatePass: true,
          changedFiles: changedPaths,
          siteConfigParsed,
        });
        await appendAssistantMessage({
          projectId: project._id,
          content: successOwnerMessage,
          metadata: {
            editJobId: jobId,
            outcome: 'success',
            changedFiles: changedPaths,
            previewVersion: newVersion,
            timing: {
              totalMs: editTimer.totalMs(),
              phases: timingSummary,
              slowestPhase: slowest?.phase,
              slowestMs: slowest?.durationMs,
            },
            strategy: agentResult.strategy,
            lastGalleryEdit: agentResult.lastGalleryEdit,
            editFocusStack: agentResult.editFocusStack,
            arize: observabilityMeta?.arize ?? { syncStatus: 'pending' },
            observability: observabilityMeta?.observability,
          },
        });

        emit('step', { id: 'validate', label: 'Checking the preview', status: 'completed' });
        emit('step', { id: 'finish', label: finishLabel, status: 'completed' });
        emit('done', {
          ok: true,
          jobId,
          result: {
            ok: true,
            jobId,
            ownerMessage: successOwnerMessage,
            previewVerified: editStreamOutcome.previewSynced,
            editApplied: editStreamOutcome.editApplied,
            previewSynced: editStreamOutcome.previewSynced,
            previewVerifyStatus: editStreamOutcome.previewVerifyStatus,
            previewVerifyReason: editStreamOutcome.previewVerifyReason,
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
