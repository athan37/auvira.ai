export type ObservabilityFlowType = 'edit' | 'clone' | 'generate';

export type ObservabilityBuilderTypeInput =
  | 'la_mue_edit'
  | 'la_mue_clone'
  | 'la_mue_generate';

/** Wire-safe builder_type values accepted by Site Monitor OpenAPI v0.6.0. */
export type MonitorBuilderType = 'html_builder' | 'la_mue_edit';

/** Monitor-supported builder_type values (OpenAPI v0.6.0). */
export const MONITOR_SUPPORTED_BUILDER_TYPES: readonly MonitorBuilderType[] = [
  'html_builder',
  'la_mue_edit',
] as const;

const FLOW_BY_REQUEST: Record<ObservabilityBuilderTypeInput, ObservabilityFlowType> = {
  la_mue_edit: 'edit',
  la_mue_clone: 'clone',
  la_mue_generate: 'generate',
};

export interface NormalizeObservabilityBuilderTypeResult {
  builderType: MonitorBuilderType;
  flowType: ObservabilityFlowType;
  usedFallback: boolean;
}

/**
 * Map internal builder intent to a Monitor-safe builder_type.
 * Clone/generate fall back to la_mue_edit until Site Monitor extends its enum.
 */
export function normalizeObservabilityBuilderType(input: {
  requested: ObservabilityBuilderTypeInput;
  supported?: readonly string[];
}): NormalizeObservabilityBuilderTypeResult {
  const supported = input.supported ?? MONITOR_SUPPORTED_BUILDER_TYPES;
  const flowType = FLOW_BY_REQUEST[input.requested];

  if (supported.includes(input.requested)) {
    return {
      builderType: input.requested as MonitorBuilderType,
      flowType,
      usedFallback: false,
    };
  }

  const fallback: MonitorBuilderType = 'la_mue_edit';
  if (input.requested !== 'la_mue_edit') {
    console.warn(
      `[observability] builder_type fallback: requested ${input.requested} → ${fallback} (Monitor enum); TODO: enable after Site Monitor schema adds la_mue_clone | la_mue_generate`
    );
  }

  return {
    builderType: fallback,
    flowType,
    usedFallback: input.requested !== 'la_mue_edit',
  };
}
