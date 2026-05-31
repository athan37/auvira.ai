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
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import { ProjectMessage } from '@/models/ProjectMessage';
import {
  mapMessageForApi,
  normalizeAttachmentRefs,
  type ChatApiMessage,
  type ProjectMessageMetadata,
} from './projectMessageMetadata';

const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 200;
const DEFAULT_CONTEXT_TURNS = 8;

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
}): Promise<void> {
  await connectMongoDB();
  const metadata: ProjectMessageMetadata = {
    attachments: normalizeAttachmentRefs(input.attachments ?? []),
    arize: { syncStatus: 'pending' },
  };
  if (input.clientMessageId) metadata.clientMessageId = input.clientMessageId;

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

export async function buildConversationHistory(input: {
  projectId: string | mongoose.Types.ObjectId;
  maxTurns?: number;
}): Promise<ConversationTurn[]> {
  await connectMongoDB();
  const projectObjectId = asObjectId(input.projectId);
  const maxTurns = Math.max(1, Math.floor(input.maxTurns ?? DEFAULT_CONTEXT_TURNS));
  const docs = await ProjectMessage.find({
    projectId: projectObjectId,
    role: { $in: ['user', 'assistant'] },
  })
    .select('role content')
    .sort({ createdAt: -1 })
    .limit(maxTurns)
    .lean();

  return docs
    .reverse()
    .map((doc) => ({
      role: doc.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(doc.content || '').slice(0, 2000),
    }));
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
