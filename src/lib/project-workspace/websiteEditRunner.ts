/**
 * Owner website edit orchestrator — GitLab-only Website Edit Agent.
 */

import { promises as fs } from 'fs';
import { runWebsiteEditAgent } from './edit-agent';
import { buildEditFocusStackAfterEdit, lastGalleryEditFromFocusStack } from './edit-shared/editFocus';
import type { AgentStepEvent, EditFocusStack } from './edit-shared/types';
import { isAllowedWorkspacePath } from './workspaceEditShared';
import { isInfraBaselineReady } from './infra/isInfraBaselineReady';
import type { WorkspaceGateway } from './workspaceGateway';

export type WebsiteEditAgentMode = 'ts';

export interface WebsiteEditResult {
  ok: boolean;
  summary?: string;
  ownerMessage?: string;
  rawOutput?: string;
  error?: string;
  changedFiles?: string[];
  agent?: WebsiteEditAgentMode;
  strategy?: string;
  tier?: string;
  confidence?: string;
  verifyProfile?: string;
  needsClarification?: boolean;
  suggestedReplies?: string[];
  editMeta?: import('./edit-shared/types').WebsiteEditAgentResult['editMeta'];
  lastGalleryEdit?: import('./edit-shared/types').LastGalleryEdit;
  editFocusStack?: EditFocusStack;
  agentLatencyBreakdown?: Record<string, number>;
  plannerPath?: 'deterministic' | 'explorer' | 'llm' | 'clarification';
  clarificationAnchor?: import('./edit-shared/types').WebsiteEditAgentResult['clarificationAnchor'];
  guidanceHints?: string[];
  ambiguityReasons?: string[];
  resolvedReferences?: import('@/lib/project-workspace/edit-context/implicitReferenceTypes').ImplicitReferenceRecord[];
}

export interface WebsiteEditOptions {
  workspacePath: string;
  ownerMessage: string;
  projectId: string;
  mode: 'gitlab';
  attachments?: import('./workspaceAssetTypes').WorkspaceAssetAttachment[];
  gateway?: WorkspaceGateway;
  conversationHistory?: import('./edit-shared/types').ConversationTurn[];
  lastGalleryEdit?: import('./edit-shared/types').LastGalleryEdit;
  editFocusStack?: EditFocusStack;
  selectedTarget?: import('./edit-shared/selectedTargetTypes').SelectedTargetInput;
  editJobId?: string;
  infraStatus?: 'pending' | 'ready' | 'failed' | string;
  infraVersion?: number;
  coachingContext?: import('@/lib/observability/types').ObservabilityCoachingContext | null;
  projectIntent?: import('@/lib/observability/types').ObservabilityProjectIntent | null;
}

/**
 * Run the website edit agent for an owner request.
 */
export async function runWebsiteEdit(
  options: WebsiteEditOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditResult> {
  if (!options.gateway && !isAllowedWorkspacePath(options.workspacePath)) {
    return {
      ok: false,
      error: 'Workspace path is not in an allowed directory.',
      agent: 'ts',
    };
  }

  if (!options.gateway) {
    try {
      const stat = await fs.stat(options.workspacePath);
      if (!stat.isDirectory()) {
        return { ok: false, error: 'Workspace path is not a directory.', agent: 'ts' };
      }
    } catch {
      return { ok: false, error: 'Workspace does not exist.', agent: 'ts' };
    }
  }

  const infraBaselineReady = isInfraBaselineReady({
    infraStatus: options.infraStatus,
    infraVersion: options.infraVersion,
  });
  const resolvedGalleryEdit =
    options.lastGalleryEdit ?? lastGalleryEditFromFocusStack(options.editFocusStack);
  const agentOptions = {
    workspacePath: options.workspacePath,
    ownerMessage: options.ownerMessage,
    projectId: options.projectId,
    mode: 'gitlab' as const,
    attachments: options.attachments,
    gateway: options.gateway,
    conversationHistory: options.conversationHistory,
    lastGalleryEdit: resolvedGalleryEdit ?? undefined,
    editFocusStack: options.editFocusStack,
    selectedTarget: options.selectedTarget,
    infraBaselineReady,
    coachingContext: options.coachingContext,
    projectIntent: options.projectIntent,
  };
  const result = await runWebsiteEditAgent(agentOptions, onStep);

  const editFocusStack =
    result.ok && !result.needsClarification
      ? buildEditFocusStackAfterEdit({
          priorStack: options.editFocusStack,
          result,
          editJobId: options.editJobId,
        })
      : options.editFocusStack ?? { items: [] };

  const lastGalleryEdit =
    result.lastGalleryEdit ?? lastGalleryEditFromFocusStack(editFocusStack) ?? undefined;

  return {
    ok: result.ok,
    summary: result.summary || result.ownerMessage,
    ownerMessage: result.ownerMessage,
    error: result.error,
    changedFiles: result.changedFiles,
    agent: 'ts',
    strategy: result.strategy,
    tier: result.tier,
    confidence: result.confidence,
    verifyProfile: result.verifyProfile,
    needsClarification: result.needsClarification,
    suggestedReplies: result.suggestedReplies,
    editMeta: result.editMeta,
    lastGalleryEdit,
    editFocusStack,
    agentLatencyBreakdown: result.agentLatencyBreakdown,
    plannerPath: result.plannerPath,
    clarificationAnchor: result.clarificationAnchor,
    guidanceHints: result.guidanceHints,
    ambiguityReasons: result.ambiguityReasons,
    resolvedReferences: result.resolvedReferences,
  };
}
