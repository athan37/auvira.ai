import mongoose from 'mongoose';
import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteProject } from '@/models/WebsiteProject';
import type {
  ObservabilityProjectMemory,
  ProjectMemoryScope,
  ProjectMemorySlot,
} from './types';
import type { IWebsiteProject } from '@/models/WebsiteProject';

const MAX_LOCAL_SLOTS = 50;

function isValidProjectObjectId(projectId: string): boolean {
  return mongoose.Types.ObjectId.isValid(projectId) && String(new mongoose.Types.ObjectId(projectId)) === projectId;
}

function slotKey(slot: Pick<ProjectMemorySlot, 'kind' | 'scope' | 'phrase_aliases'>): string {
  const alias = slot.phrase_aliases[0]?.toLowerCase().trim() ?? '';
  return `${slot.kind}:${JSON.stringify(slot.scope)}:${alias}`;
}

function mergeScopesEqual(a: ProjectMemoryScope, b: ProjectMemoryScope): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Read project memory slots persisted locally on WebsiteProject (Monitor fallback). */
export async function readLocalProjectMemory(
  projectId: string
): Promise<ObservabilityProjectMemory | null> {
  if (!isValidProjectObjectId(projectId)) return null;
  await connectMongoDB();
  const doc = (await WebsiteProject.findById(projectId)
    .select('projectMemorySlots')
    .lean()) as Pick<IWebsiteProject, 'projectMemorySlots'> | null;
  const slots = (doc?.projectMemorySlots ?? []) as ProjectMemorySlot[];
  if (slots.length === 0) return null;
  return {
    slots,
    turn_count: slots.length,
    updated_at: null,
  };
}

/** Upsert memory slots on WebsiteProject (capped, merge by kind + scope + primary alias). */
export async function upsertLocalProjectMemorySlots(input: {
  projectId: string;
  slots: Array<Omit<ProjectMemorySlot, 'id' | 'updated_at'> & { id?: string }>;
}): Promise<void> {
  if (input.slots.length === 0 || !isValidProjectObjectId(input.projectId)) return;
  await connectMongoDB();

  const projectObjectId = new mongoose.Types.ObjectId(input.projectId);
  const doc = (await WebsiteProject.findById(projectObjectId)
    .select('projectMemorySlots')
    .lean()) as Pick<IWebsiteProject, 'projectMemorySlots'> | null;
  const existing = ((doc?.projectMemorySlots ?? []) as ProjectMemorySlot[]).slice();

  for (const incoming of input.slots) {
    const now = new Date().toISOString();
    const normalized: ProjectMemorySlot = {
      id: incoming.id ?? crypto.randomUUID(),
      kind: incoming.kind,
      phrase_aliases: incoming.phrase_aliases,
      value: incoming.value,
      scope: incoming.scope,
      provenance: incoming.provenance,
      updated_at: now,
    };

    const key = slotKey(normalized);
    const index = existing.findIndex((slot) => slotKey(slot) === key);
    if (index >= 0) {
      const prior = existing[index]!;
      existing[index] = {
        ...prior,
        ...normalized,
        phrase_aliases: [...new Set([...prior.phrase_aliases, ...normalized.phrase_aliases])].slice(
          0,
          5
        ),
      };
    } else {
      existing.push(normalized);
    }
  }

  const capped = existing.slice(-MAX_LOCAL_SLOTS);
  await WebsiteProject.updateOne(
    { _id: projectObjectId },
    { $set: { projectMemorySlots: capped } }
  );
}

/** Merge remote Monitor memory with local Mongo slots (local fills gaps). */
export function mergeProjectMemory(
  remote: ObservabilityProjectMemory | null,
  local: ObservabilityProjectMemory | null
): ObservabilityProjectMemory | null {
  if (!remote && !local) return null;
  if (!remote) return local;
  if (!local) return remote;

  const merged = [...remote.slots];
  for (const localSlot of local.slots) {
    const exists = merged.some(
      (slot) =>
        slot.kind === localSlot.kind &&
        mergeScopesEqual(slot.scope, localSlot.scope) &&
        slot.phrase_aliases.some((alias) =>
          localSlot.phrase_aliases.some(
            (other) => other.toLowerCase().trim() === alias.toLowerCase().trim()
          )
        )
    );
    if (!exists) merged.push(localSlot);
  }

  return {
    slots: merged.slice(-MAX_LOCAL_SLOTS),
    turn_count: Math.max(remote.turn_count, local.turn_count, merged.length),
    updated_at: remote.updated_at ?? local.updated_at,
  };
}
