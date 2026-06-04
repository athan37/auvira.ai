import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { parseConfigFieldPath, readConfigFieldValue } from './configFieldPaths';
import { resolveConfigTextEdit } from './resolveConfigTextEdit';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';

export interface CopyEditAlreadyAppliedResult {
  applied: boolean;
  fieldPath?: string;
  expectedValue?: string;
}

/**
 * True when the requested copy edit value is already present in siteConfig
 * (agent reported success but file hashes did not change).
 */
export function detectCopyEditAlreadyApplied(
  siteConfigContent: string,
  message: string,
  selectedTarget?: SelectedTargetInput
): CopyEditAlreadyAppliedResult {
  const pinnedSectionIndex =
    selectedTarget?.kind === 'section' && selectedTarget.sectionIndex != null
      ? selectedTarget.sectionIndex
      : undefined;

  const resolved = resolveConfigTextEdit({
    message,
    siteConfigContent,
    pinnedSectionIndex,
  });

  if (resolved.kind !== 'apply') {
    return { applied: false };
  }

  const parsedPath = parseConfigFieldPath(resolved.fieldPath);
  const parsedConfig = parseSiteConfigSource(siteConfigContent) as Record<string, unknown> | null;
  if (!parsedPath || !parsedConfig) {
    return { applied: false };
  }

  const actual = String(readConfigFieldValue(parsedConfig, parsedPath) ?? '').trim();
  const expected = resolved.value.trim();
  if (!expected || actual !== expected) {
    return { applied: false };
  }

  return {
    applied: true,
    fieldPath: resolved.fieldPath,
    expectedValue: expected,
  };
}
