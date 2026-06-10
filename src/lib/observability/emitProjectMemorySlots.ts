import { postObservabilityMemory } from './client';
import { isObservabilityEnabled } from './config';
import type { ProjectMemorySlot, UpsertProjectMemoryPayload } from './types';

/** Upsert project memory slots to Site Monitor (soft-fail; never blocks product flow). */
export async function emitProjectMemorySlots(input: {
  projectId: string;
  slots: Array<Omit<ProjectMemorySlot, 'id' | 'updated_at'> & { id?: string }>;
}): Promise<boolean> {
  if (!isObservabilityEnabled() || input.slots.length === 0) return false;

  const payload: UpsertProjectMemoryPayload = { slots: input.slots };

  try {
    const result = await postObservabilityMemory({
      projectId: input.projectId,
      payload,
    });
    return result != null;
  } catch (error) {
    console.warn('[observability] emit memory failed', {
      projectId: input.projectId,
      slotCount: input.slots.length,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}
