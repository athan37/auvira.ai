import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  cloneBuildConversationId,
  clonePreviewConversationId,
  cloneWizardConversationId,
  ensureObservabilityRegistration,
  recordObservabilityTurn,
  resolveCloneObservabilityProjectId,
} from '@/lib/observability';
import type {
  ObservabilityEditOutcome,
  ObservabilityTurnMetadata,
  ObservabilityTurnPhase,
} from '@/lib/observability/types';

export type CloneObservabilityPhase =
  | 'process'
  | 'build-preview'
  | 'preview-chat'
  | 'revise-plan';

function conversationIdForPhase(input: {
  phase: CloneObservabilityPhase;
  jobId: string;
  projectId: string;
}): string {
  switch (input.phase) {
    case 'process':
    case 'revise-plan':
      return cloneWizardConversationId(input.jobId);
    case 'build-preview':
      return cloneBuildConversationId(input.projectId);
    case 'preview-chat':
      return clonePreviewConversationId(input.projectId);
  }
}

export interface RecordCloneObservabilityTurnInput {
  jobId: string;
  createdProjectId?: string | null;
  projectTitle: string;
  phase: CloneObservabilityPhase;
  turnId: string;
  turnIndex: number;
  userMessage: string;
  reply: string;
  outcome: ObservabilityEditOutcome;
  verifyPass?: boolean;
  buildGatePass?: boolean;
  siteConfigParsed?: {
    businessName?: string;
    sections?: Array<{ type?: string; title?: string; items?: unknown[] }>;
  } | null;
  phaseEvents?: ObservabilityTurnPhase[];
  latencyMs?: number;
}

/** Register clone project/conversation and record a turn (non-throwing). */
export async function recordCloneObservabilityTurn(
  input: RecordCloneObservabilityTurnInput
): Promise<ObservabilityTurnMetadata | null> {
  const projectId = resolveCloneObservabilityProjectId({
    jobId: input.jobId,
    createdProjectId: input.createdProjectId,
  });
  const conversationId = conversationIdForPhase({
    phase: input.phase,
    jobId: input.jobId,
    projectId,
  });

  await ensureObservabilityRegistration({
    projectId,
    title: input.projectTitle,
    conversations: [{ conversationId, title: `Clone ${input.phase}` }],
  });

  const timer = new EditStepTimer();
  return recordObservabilityTurn({
    projectId,
    conversationId,
    turnId: input.turnId,
    turnIndex: input.turnIndex,
    userMessage: input.userMessage,
    reply: input.reply,
    outcome: input.outcome,
    verifyPass: input.verifyPass,
    buildGatePass: input.buildGatePass,
    siteConfigParsed: input.siteConfigParsed,
    editTimer: timer,
    requestedBuilderType: 'la_mue_clone',
    flowType: 'clone',
    clonePhase: input.phase,
    phaseEvents: input.phaseEvents,
    latencyMs: input.latencyMs ?? timer.totalMs(),
  });
}

/** Count prior observability log entries on a CloneJob for turn_index. */
export function countCloneObservabilityTurns(
  logs: Array<{ stage?: string }> | undefined
): number {
  return (logs ?? []).filter((entry) => entry.stage === 'observability').length;
}
