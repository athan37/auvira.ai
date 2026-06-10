import { fetchObservabilityMemoryRaw } from './client';
import { isObservabilityEnabled } from './config';
import { mergeProjectMemory, readLocalProjectMemory } from './localProjectMemory';
import type {
  EditPatternValue,
  ObservabilityProjectMemory,
  ProjectMemoryScope,
  ProjectMemorySlot,
  ProjectMemorySlotKind,
} from './types';

const VALID_KINDS: ProjectMemorySlotKind[] = [
  'color',
  'copy',
  'cta',
  'style_token',
  'edit_pattern',
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseScope(raw: unknown): ProjectMemoryScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = typeof (raw as { type?: unknown }).type === 'string'
    ? (raw as { type: string }).type
    : '';
  if (type === 'project') return { type: 'project' };
  if (type === 'hero') return { type: 'hero' };
  if (type === 'section_type') {
    const sectionType = (raw as { sectionType?: unknown }).sectionType;
    if (typeof sectionType === 'string' && sectionType.trim()) {
      return { type: 'section_type', sectionType: sectionType.trim() };
    }
  }
  if (type === 'section_index') {
    const sectionIndex = (raw as { sectionIndex?: unknown }).sectionIndex;
    if (typeof sectionIndex === 'number' && Number.isFinite(sectionIndex)) {
      return { type: 'section_index', sectionIndex };
    }
  }
  if (type === 'field') {
    const fieldPath = (raw as { fieldPath?: unknown }).fieldPath;
    if (typeof fieldPath === 'string' && fieldPath.trim()) {
      return { type: 'field', fieldPath: fieldPath.trim() };
    }
  }
  return null;
}

function parseEditPatternValue(raw: unknown): EditPatternValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const what = (raw as { what?: unknown }).what;
  if (typeof what !== 'string') return null;
  const allowed = ['copy', 'style_background', 'style_text', 'style_card', 'structure'] as const;
  if (!allowed.includes(what as (typeof allowed)[number])) return null;
  const params = (raw as { params?: unknown }).params;
  return {
    what: what as EditPatternValue['what'],
    ...(params && typeof params === 'object' ? { params: params as Record<string, unknown> } : {}),
  };
}

function parseSlot(raw: unknown, index: number): ProjectMemorySlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const kind = (raw as { kind?: unknown }).kind;
  if (typeof kind !== 'string' || !VALID_KINDS.includes(kind as ProjectMemorySlotKind)) {
    return null;
  }
  const scope = parseScope((raw as { scope?: unknown }).scope);
  if (!scope) return null;

  const valueRaw = (raw as { value?: unknown }).value;
  let value: string | EditPatternValue;
  if (kind === 'edit_pattern') {
    const pattern = parseEditPatternValue(valueRaw);
    if (!pattern) return null;
    value = pattern;
  } else if (typeof valueRaw === 'string' && valueRaw.trim()) {
    value = valueRaw.trim();
  } else {
    return null;
  }

  const id =
    typeof (raw as { id?: unknown }).id === 'string' && (raw as { id: string }).id.trim()
      ? (raw as { id: string }).id.trim()
      : `slot-${index}`;

  const provenanceRaw = (raw as { provenance?: unknown }).provenance;
  const provenance =
    provenanceRaw && typeof provenanceRaw === 'object'
      ? {
          turn_id:
            typeof (provenanceRaw as { turn_id?: unknown }).turn_id === 'string'
              ? (provenanceRaw as { turn_id: string }).turn_id
              : '',
          user_message_excerpt:
            typeof (provenanceRaw as { user_message_excerpt?: unknown }).user_message_excerpt ===
            'string'
              ? (provenanceRaw as { user_message_excerpt: string }).user_message_excerpt
              : undefined,
        }
      : undefined;

  return {
    id,
    kind: kind as ProjectMemorySlotKind,
    phrase_aliases: asStringArray((raw as { phrase_aliases?: unknown }).phrase_aliases),
    value,
    scope,
    ...(provenance?.turn_id ? { provenance } : {}),
    updated_at:
      typeof (raw as { updated_at?: unknown }).updated_at === 'string'
        ? (raw as { updated_at: string }).updated_at
        : undefined,
  };
}

/** Parse Site Monitor GET /memory payload into typed project memory. */
export function parseObservabilityProjectMemory(
  raw: Record<string, unknown>
): ObservabilityProjectMemory {
  const slotsRaw = Array.isArray(raw.slots) ? raw.slots : [];
  const slots = slotsRaw
    .map((entry, index) => parseSlot(entry, index))
    .filter((slot): slot is ProjectMemorySlot => slot != null);

  return {
    slots,
    turn_count: typeof raw.turn_count === 'number' ? raw.turn_count : slots.length,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

/** Fetch structured project memory from Site Monitor GET /memory (non-throwing). */
export async function fetchObservabilityMemory(
  projectId: string
): Promise<ObservabilityProjectMemory | null> {
  if (!isObservabilityEnabled()) return null;

  let remote: ObservabilityProjectMemory | null = null;
  try {
    const raw = await fetchObservabilityMemoryRaw(projectId);
    if (raw && typeof raw === 'object') {
      remote = parseObservabilityProjectMemory(raw);
    }
  } catch (error) {
    console.warn('[observability] fetch memory failed', {
      projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  const local = await readLocalProjectMemory(projectId).catch(() => null);
  return mergeProjectMemory(remote, local);
}
