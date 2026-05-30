import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { formatStructureMap } from '@/lib/project-workspace/website-edit-agent/resolveSectionTarget';
import { EDIT_SKILL_NAMES } from './editPlan.schema';

const PLANNER_SYSTEM = `You are Website Edit Agent V3 planner for small business sites (siteConfig.ts + section-loop page.tsx).

Return ONLY valid JSON matching the schema. planVersion should be "website-agent-v3".

Domain skills (executor maps these to typed tools — never use write_file for common edits):
${EDIT_SKILL_NAMES.map((s) => `- ${s}`).join('\n')}

Rules:
- Prefer config skills over custom_code_edit.
- update_section_style → section background/card via params.backgroundColor or params.presentation.backgroundClass.
- update_contact → params phone, email, or address with exact user value.
- update_hero → params headline, subheadline, or tagline.
- When EditContext already resolved a section target, use that sectionIndex in target/params.
- If ambiguous or missing value, set needsClarification true, steps [], clarificationQuestion, suggestedReplies (2+).
- Do not invent business facts.`;

export function buildPlanEditSystemPrompt(): string {
  return PLANNER_SYSTEM;
}

export function buildPlanEditUserPrompt(editContext: EditContext, userPrompt: string): string {
  const { siteModel, target, sectionCatalog, riskFlags, verificationContract } = editContext;
  const structureMap =
    siteModel.structure != null
      ? formatStructureMap(siteModel.structure)
      : sectionCatalog.textBlock;

  const resolvedTarget =
    target.sectionIndex != null
      ? `Resolved section [${target.sectionIndex}] "${target.title ?? ''}" (${target.confidence})`
      : target.kind === 'hero'
        ? 'Resolved target: hero'
        : 'Target unresolved — clarify if needed';

  const sectionSummaries = editContext.sections
    .map(
      (s) =>
        `[${s.index}] type=${s.type} title="${s.title}" bg=${s.presentation?.backgroundClass ?? 'preset'}`
    )
    .join('\n');

  const snippetBlock =
    editContext.selectedSnippets.length > 0
      ? editContext.selectedSnippets
          .map((s) => `--- ${s.path} (${s.label}) ---\n${s.content.slice(0, 2000)}`)
          .join('\n\n')
      : '(no snippets)';

  return `Business: ${siteModel.parsedConfig?.businessName ?? '(unknown)'}
Archetype: ${siteModel.archetype}
Risk: ${riskFlags.level} (${riskFlags.reasons.join('; ') || 'none'})

${resolvedTarget}

Sections:
${sectionSummaries || '(none)'}

Structure map:
${structureMap}

Verification hints:
${JSON.stringify(verificationContract.checks)}

Context snippets:
${snippetBlock}

User request:
${userPrompt.trim()}`;
}
