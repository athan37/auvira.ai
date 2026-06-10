import mongoose from 'mongoose';
import { connectMongoDB } from '@/lib/mongodb';
import {
  editFocusFromLastGalleryEdit,
  lastGalleryEditFromFocusStack,
  normalizeEditFocusStack,
} from '@/lib/project-workspace/edit-shared/editFocus';
import type {
  ConversationTurn,
  EditFocusStack,
  LastGalleryEdit,
} from '@/lib/project-workspace/edit-shared/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import { ProjectMessage } from '@/models/ProjectMessage';
import {
  mapMessageForApi,
  normalizeAttachmentRefs,
  type ChatApiMessage,
  type ClarificationAnchor,
  type ProjectMessageMetadata,
} from './projectMessageMetadata';

/** Max user+assistant turn pairs fed into the edit agent. */
export const HISTORY_TURN_PAIR_LIMIT = 16;
/** Max chat messages loaded for agent context (2 per turn pair). */
export const HISTORY_MESSAGE_LIMIT = HISTORY_TURN_PAIR_LIMIT * 2;

const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 200;
const DEFAULT_CONTEXT_TURNS = HISTORY_TURN_PAIR_LIMIT;

function asObjectId(projectId: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  if (projectId instanceof mongoose.Types.ObjectId) return projectId;
  return new mongoose.Types.ObjectId(projectId);
}

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_MESSAGE_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_MESSAGE_LIMIT);
}

export async function appendUserMessage(input: {
  projectId: string | mongoose.Types.ObjectId;
  content: string;
  attachments?: WorkspaceAssetAttachment[];
  clientMessageId?: string;
  selectedTarget?: SelectedTargetInput;
}): Promise<void> {
  await connectMongoDB();
  const metadata: ProjectMessageMetadata = {
    attachments: normalizeAttachmentRefs(input.attachments ?? []),
    arize: { syncStatus: 'pending' },
  };
  if (input.clientMessageId) metadata.clientMessageId = input.clientMessageId;
  if (input.selectedTarget) metadata.selectedTarget = input.selectedTarget;

  await ProjectMessage.create({
    projectId: asObjectId(input.projectId),
    role: 'user',
    content: input.content,
    metadata,
  });
}

export async function appendAssistantMessage(input: {
  projectId: string | mongoose.Types.ObjectId;
  content: string;
  metadata?: ProjectMessageMetadata;
}): Promise<void> {
  await connectMongoDB();
  const metadata: ProjectMessageMetadata = {
    ...(input.metadata ?? {}),
    arize: input.metadata?.arize ?? { syncStatus: 'pending' },
  };
  await ProjectMessage.create({
    projectId: asObjectId(input.projectId),
    role: 'assistant',
    content: input.content,
    metadata,
  });
}

export async function listProjectMessages(input: {
  projectId: string | mongoose.Types.ObjectId;
  limit?: number;
}): Promise<ChatApiMessage[]> {
  await connectMongoDB();
  const projectObjectId = asObjectId(input.projectId);
  const limit = clampLimit(input.limit);
  const docs = await ProjectMessage.find({ projectId: projectObjectId })
    .select('role content metadata createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs
    .reverse()
    .map((doc) =>
      mapMessageForApi({
        role: doc.role,
        content: doc.content,
        createdAt: doc.createdAt,
        metadata: doc.metadata,
      })
    );
}

function resolvedReferencesFromMessageMetadata(
  meta: ProjectMessageMetadata | undefined
): ProjectMessageMetadata['resolvedReferences'] {
  if (meta?.observability?.appliedProjectMemory?.length) {
    return meta.observability.appliedProjectMemory;
  }
  if (meta?.resolvedReferences?.length) {
    return meta.resolvedReferences;
  }
  const legacyObs = meta?.observability as { resolvedReferences?: typeof meta.resolvedReferences } | undefined;
  if (legacyObs?.resolvedReferences?.length) {
    return legacyObs.resolvedReferences;
  }
  return undefined;
}

export async function buildConversationHistory(input: {
  projectId: string | mongoose.Types.ObjectId;
  /** Approximate user+assistant turn pairs; fetches up to 2× this many messages. */
  maxTurns?: number;
}): Promise<ConversationTurn[]> {
  await connectMongoDB();
  const projectObjectId = asObjectId(input.projectId);
  const turnPairs = Math.max(1, Math.floor(input.maxTurns ?? DEFAULT_CONTEXT_TURNS));
  const messageLimit = Math.min(turnPairs * 2, HISTORY_MESSAGE_LIMIT);
  const docs = await ProjectMessage.find({
    projectId: projectObjectId,
    role: { $in: ['user', 'assistant'] },
  })
    .select('role content metadata')
    .sort({ createdAt: -1 })
    .limit(messageLimit)
    .lean();

  return docs
    .reverse()
    .map((doc) => {
      const meta = doc.metadata as ProjectMessageMetadata | undefined;
      const metadataFields: Record<string, unknown> = {};
      if (meta?.selectedTarget) metadataFields.selectedTarget = meta.selectedTarget;
      if (meta?.clarificationAnchor) {
        metadataFields.clarificationAnchor = meta.clarificationAnchor as ClarificationAnchor;
      }
      if (meta?.outcome) metadataFields.outcome = meta.outcome;
      if (meta?.suggestedReplies?.length) metadataFields.suggestedReplies = meta.suggestedReplies;
      if (meta?.pendingImplicitRef) metadataFields.pendingImplicitRef = meta.pendingImplicitRef;
      const appliedMemory = resolvedReferencesFromMessageMetadata(meta);
      if (appliedMemory?.length) metadataFields.resolvedReferences = appliedMemory;

      const metadata =
        Object.keys(metadataFields).length > 0 ? metadataFields : undefined;
      return {
        role: doc.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(doc.content || '').slice(0, 2000),
        ...(metadata ? { metadata } : {}),
      };
    });
}

/** Most recent gallery placement artifact from assistant message metadata. */
export async function resolveLastGalleryEditFromProject(input: {
  projectId: string | mongoose.Types.ObjectId;
  maxMessages?: number;
}): Promise<LastGalleryEdit | null> {
  await connectMongoDB();
  const projectObjectId = asObjectId(input.projectId);
  const limit = Math.max(1, Math.floor(input.maxMessages ?? 24));
  const docs = await ProjectMessage.find({
    projectId: projectObjectId,
    role: 'assistant',
  })
    .select('metadata')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  for (const doc of docs) {
    const meta = doc.metadata as ProjectMessageMetadata | undefined;
    const edit = meta?.lastGalleryEdit;
    if (
      edit &&
      typeof edit.sectionIndex === 'number' &&
      typeof edit.title === 'string' &&
      Array.isArray(edit.imageUrls) &&
      typeof edit.imageCount === 'number'
    ) {
      return edit;
    }
  }
  return null;
}

/** Most recent edit focus stack from assistant message metadata. */
export async function resolveEditFocusFromProject(input: {
  projectId: string | mongoose.Types.ObjectId;
  maxMessages?: number;
}): Promise<EditFocusStack> {
  await connectMongoDB();
  const projectObjectId = asObjectId(input.projectId);
  const limit = Math.max(1, Math.floor(input.maxMessages ?? 24));
  const docs = await ProjectMessage.find({
    projectId: projectObjectId,
    role: 'assistant',
  })
    .select('metadata')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  for (const doc of docs) {
    const meta = doc.metadata as ProjectMessageMetadata | undefined;
    const stack = normalizeEditFocusStack(meta?.editFocusStack);
    if (stack) return stack;
  }

  const legacyGallery = await resolveLastGalleryEditFromProject(input);
  if (legacyGallery) {
    return { items: [editFocusFromLastGalleryEdit(legacyGallery)] };
  }

  return { items: [] };
}

/** Drop the current user turn when it was just appended before building agent history. */
export function trimCurrentUserTurn(
  history: ConversationTurn[],
  ownerMessage: string
): ConversationTurn[] {
  if (history.length === 0) return history;
  const last = history[history.length - 1];
  const owner = ownerMessage.trim();
  const lastContent = last?.content.trim() ?? '';
  if (
    last?.role === 'user' &&
    (lastContent === owner || lastContent.toLowerCase() === owner.toLowerCase())
  ) {
    return history.slice(0, -1);
  }
  return history;
}

/** Resolve gallery artifact — prefers focus stack, falls back to legacy metadata. */
export async function resolveLastGalleryEditForProject(input: {
  projectId: string | mongoose.Types.ObjectId;
  maxMessages?: number;
}): Promise<LastGalleryEdit | null> {
  const stack = await resolveEditFocusFromProject(input);
  const fromStack = lastGalleryEditFromFocusStack(stack);
  if (fromStack) return fromStack;
  return resolveLastGalleryEditFromProject(input);
}
