import type { DesignBrief } from '@/lib/agent/schemas';
import type { TemplateSelection } from '@/lib/agent/selectTemplateAgent';
import {
  getDefaultLayoutStarter,
  getLayoutStarter,
  type LayoutStarter,
} from '@/lib/builder/layoutStarters';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import type { SiteSpec } from '@/lib/agent/schemas';
import type { GenerateWebsiteFilesResult } from '@/lib/builder/types';

export interface CloneSuggestedTemplate {
  category: string;
  variant: string;
  reason?: string;
  layoutStarterId?: string;
}

/** Build clone job suggestedTemplate with independent layout + color selections. */
export function buildCloneSuggestedTemplate(input: {
  templateCategory?: string;
  templateVariant?: string;
  layoutStarterId?: string;
  themeOwnerSelected?: boolean;
  existing?: CloneSuggestedTemplate | null;
}): CloneSuggestedTemplate {
  const existing = input.existing ?? {
    category: 'general-service',
    variant: 'modern-clean',
  };

  const layoutStarter =
    getLayoutStarter(input.layoutStarterId) ??
    getLayoutStarter(existing.layoutStarterId) ??
    getDefaultLayoutStarter();

  const next: CloneSuggestedTemplate = {
    ...existing,
    layoutStarterId: layoutStarter.id,
  };

  if (input.templateCategory && input.templateVariant) {
    const normalized = normalizeTemplateSelection(input.templateCategory, input.templateVariant);
    next.category = normalized.category;
    next.variant = normalized.variant;
    if (input.themeOwnerSelected) {
      next.reason = OWNER_TEMPLATE_REASON;
    }
  }

  return next;
}

/** Resolve layout starter from a clone job template selection. */
export function resolveCloneLayoutStarter(
  suggestedTemplate?: CloneSuggestedTemplate | null
): LayoutStarter | undefined {
  if (!suggestedTemplate?.layoutStarterId) return undefined;
  return getLayoutStarter(suggestedTemplate.layoutStarterId) ?? getDefaultLayoutStarter();
}

/** Resolve color theme from a clone job template selection. */
export function resolveCloneTemplateSelection(
  suggestedTemplate?: CloneSuggestedTemplate | null
): TemplateSelection {
  const raw = suggestedTemplate ?? { category: 'general-service', variant: 'modern-clean' };
  const normalized = normalizeTemplateSelection(raw.category, raw.variant);
  return {
    category: normalized.category,
    variant: normalized.variant,
    reason: raw.reason || 'AI suggested',
  };
}

/** Attach layout strategy tokens to the design brief when a layout starter is selected. */
export function mergeLayoutStrategyIntoDesignBrief(
  designBrief: DesignBrief,
  layoutStarter?: LayoutStarter
): DesignBrief {
  if (!layoutStarter) return designBrief;
  return { ...designBrief, layoutStrategy: layoutStarter.layoutStrategy };
}

/** Generate clone site files using decoupled layout + color template selections. */
export function generateCloneWebsiteFiles(
  siteSpec: SiteSpec,
  projectName: string,
  designBrief: DesignBrief,
  suggestedTemplate?: CloneSuggestedTemplate | null
): GenerateWebsiteFilesResult {
  const layoutStarter = resolveCloneLayoutStarter(suggestedTemplate);
  const template = resolveCloneTemplateSelection(suggestedTemplate);
  const brief = mergeLayoutStrategyIntoDesignBrief(designBrief, layoutStarter);
  return generateWebsiteFiles(siteSpec, projectName, brief, template, layoutStarter);
}
