import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { updateConfigFieldInSource } from '@/lib/project-workspace/siteConfigMutations';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';

export interface DeterministicCopyFallbackResult {
  applied: boolean;
  fieldPath?: string;
  value?: string;
  error?: string;
}

/**
 * Last-resort apply when the agent reported success but workspace hashes are unchanged.
 */
export async function tryDeterministicCopyFallback(options: {
  gateway: WorkspaceGateway;
  message: string;
  selectedTarget?: SelectedTargetInput;
}): Promise<DeterministicCopyFallbackResult> {
  const { gateway, message, selectedTarget } = options;

  let siteConfigContent = '';
  try {
    siteConfigContent = (await gateway.readFile('src/lib/siteConfig.ts')) ?? '';
  } catch {
    return { applied: false, error: 'siteConfig missing' };
  }
  if (!siteConfigContent.trim()) {
    return { applied: false, error: 'siteConfig empty' };
  }

  const pinnedSectionIndex =
    selectedTarget?.kind === 'section' && selectedTarget.sectionIndex != null
      ? selectedTarget.sectionIndex
      : undefined;

  const resolved = resolveConfigTextEdit({
    message,
    siteConfigContent,
    pinnedSectionIndex,
    selectedTargetContext: selectedTarget?.fieldPath
      ? {
          target: selectedTarget,
          resolved: {
            kind: selectedTarget.kind,
            sectionIndex: selectedTarget.sectionIndex,
            sectionType: selectedTarget.sectionType,
            sectionTitle: selectedTarget.sectionTitle,
            confidence: 'high',
          },
          element: { fieldPath: selectedTarget.fieldPath },
          editableFields: [],
          sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
        }
      : undefined,
  });
  if (resolved.kind !== 'apply') {
    return { applied: false, error: 'No deterministic copy target' };
  }

  const updated = updateConfigFieldInSource(
    siteConfigContent,
    resolved.fieldPath,
    resolved.value
  );
  if (!updated || updated === siteConfigContent) {
    return { applied: false, error: 'No siteConfig mutation needed' };
  }

  await gateway.writeFile('src/lib/siteConfig.ts', updated);

  return {
    applied: true,
    fieldPath: resolved.fieldPath,
    value: resolved.value,
  };
}
