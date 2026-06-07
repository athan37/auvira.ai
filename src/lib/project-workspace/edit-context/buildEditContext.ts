import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { buildEnrichedSiteStructure } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import { buildVerificationContract } from './buildVerificationContract';
import { resolveDuplicateCopyTarget } from './resolveDuplicateCopyTarget';
import { resolveEditTargetAsync } from './resolveEditTarget';
import { formatSelectedTargetForMessage } from './resolveSelectedTarget';
import { buildSelectedTargetContext } from './selectedTargetContext';
import { selectRelevantContext } from './selectRelevantContext';
import type {
  BuildEditContextInput,
  BuildEditContextResult,
  EditContext,
  EditSectionInfo,
  RiskFlags,
} from './types';

const GITLAB_WRITE_PATHS = [
  'src/lib/siteConfig.ts',
  'src/app/page.tsx',
  'src/app/globals.css',
  'tailwind.config.ts',
  'tailwind.config.js',
] as const;

function allowedWritePaths(): string[] {
  return [...GITLAB_WRITE_PATHS];
}

function buildSections(context: {
  siteConfigContent: string | null;
  pageContent: string | null;
}): EditSectionInfo[] {
  const parsed = context.siteConfigContent
    ? ((parseSiteConfigSource(context.siteConfigContent)?.sections ?? []) as Array<
        Record<string, unknown>
      >)
    : [];

  let enriched = null;
  if (context.siteConfigContent && context.pageContent) {
    try {
      enriched = buildEnrichedSiteStructure(context.siteConfigContent, context.pageContent);
    } catch {
      enriched = null;
    }
  }

  return parsed.map((section, index) => {
    const enrichedSection = enriched?.sections?.[index];
    const presentation = section.presentation as EditSectionInfo['presentation'];
    return {
      index,
      type: String(section.type ?? 'generic'),
      title: String(section.title ?? `section ${index + 1}`),
      presentation,
      rendererComponent: enrichedSection?.rendererComponent,
      itemCount: enrichedSection?.itemCount,
    };
  });
}

function detectCompoundIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAnd = /\band\b/.test(lower) || /,/.test(message);
  if (!hasAnd) return false;
  const buckets = [
    /\b(background|color|colour)\b/.test(lower),
    /\b(section|faq|testimonial|gallery)\b/.test(lower),
    /\b(headline|title|tagline)\b/.test(lower),
    /\b(phone|email|address)\b/.test(lower),
  ];
  return buckets.filter(Boolean).length >= 2;
}

function buildRiskFlags(
  message: string,
  targetConfidence: 'high' | 'medium' | 'low',
  infraBaselineReady: boolean,
  archetype: string
): RiskFlags {
  const reasons: string[] = [];
  let level: RiskFlags['level'] = 'low';

  const compoundIntent = detectCompoundIntent(message);
  if (compoundIntent) {
    reasons.push('Compound intent detected');
    level = 'medium';
  }

  const lowConfidenceTarget = targetConfidence === 'low';
  if (lowConfidenceTarget) {
    reasons.push('Low-confidence target');
    level = 'high';
  }

  if (!infraBaselineReady) {
    reasons.push('Infra baseline not ready');
    if (level === 'low') level = 'medium';
  }

  const legacyArchetype = archetype === 'hardcoded' || archetype === 'legacy';
  if (legacyArchetype) {
    reasons.push('Legacy page archetype');
    if (level === 'low') level = 'medium';
  }

  return {
    level,
    compoundIntent,
    lowConfidenceTarget,
    infraNotReady: !infraBaselineReady,
    legacyArchetype,
    reasons,
  };
}

/**
 * Build canonical EditContext before planning or deterministic routing.
 */
export async function buildEditContext(
  input: BuildEditContextInput
): Promise<BuildEditContextResult> {
  const siteModel = await getSiteModel({
    workspacePath: input.workspacePath,
    mode: input.mode,
    gateway: input.gateway,
  });

  const siteConfigContent = siteModel.siteConfigContent ?? '';
  const pageContent = siteModel.pageContent ?? '';
  const sectionCatalog = buildSiteSectionCatalog(siteConfigContent, pageContent);

  const effectiveMessageBase = resolveEffectiveEditMessage(
    input.ownerMessage,
    input.conversationHistory ?? [],
    input.editFocusStack,
    input.selectedTarget,
    { catalog: sectionCatalog }
  );

  const target = await resolveEditTargetAsync(
    input.ownerMessage,
    siteModel,
    sectionCatalog,
    input.conversationHistory ?? [],
    input.editFocusStack,
    input.selectedTarget
  );

  const sections = buildSections({ siteConfigContent, pageContent });
  const infraBaselineReady = input.infraBaselineReady === true;

  const selectedTargetContext =
    input.selectedTarget && siteConfigContent
      ? buildSelectedTargetContext({
          selectedTarget: input.selectedTarget,
          siteConfigContent,
          pageContent,
          catalog: sectionCatalog,
          target,
        })
      : undefined;

  const effectiveMessage = input.selectedTarget
    ? `${effectiveMessageBase.trim()} ${formatSelectedTargetForMessage(
        input.selectedTarget,
        selectedTargetContext?.recommendedDefaultField?.fieldPath
      )}`.trim()
    : effectiveMessageBase;

  const draftContext: EditContext = {
    workspacePath: input.workspacePath,
    mode: input.mode,
    ownerMessage: input.ownerMessage,
    effectiveMessage,
    siteModel,
    sectionCatalog,
    sections,
    target,
    selectedSnippets: [],
    allowedWritePaths: allowedWritePaths(),
    riskFlags: buildRiskFlags(
      effectiveMessage,
      target.confidence,
      infraBaselineReady,
      siteModel.archetype
    ),
    verificationContract: { checks: [] },
    infraBaselineReady,
    gateway: input.gateway,
    conversationHistory: input.conversationHistory,
    editFocusStack: input.editFocusStack,
    selectedTarget: input.selectedTarget,
    selectedTargetContext: selectedTargetContext ?? undefined,
  };

  draftContext.selectedSnippets = selectRelevantContext(draftContext);
  draftContext.verificationContract = buildVerificationContract(draftContext);

  if (!target.needsClarification && siteConfigContent) {
    const duplicate = resolveDuplicateCopyTarget(
      siteConfigContent,
      effectiveMessage,
      input.conversationHistory ?? []
    );
    if (duplicate?.needsClarification) {
      return {
        context: draftContext,
        needsClarification: true,
        clarificationMessage: duplicate.clarificationMessage,
        suggestedReplies: duplicate.suggestedReplies,
      };
    }
  }

  if (target.needsClarification && target.clarificationMessage) {
    return {
      context: draftContext,
      needsClarification: true,
      clarificationMessage: target.clarificationMessage,
      suggestedReplies: target.suggestedReplies,
    };
  }

  return {
    context: draftContext,
    needsClarification: false,
  };
}
