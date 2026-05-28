import { formatStructureMap } from '@/lib/project-workspace/website-edit-agent/resolveSectionTarget';
import { EDIT_SKILL_NAMES } from './editPlan.schema';
import type { SiteModel } from '../site-model/types';

const PLANNER_SYSTEM = `You are a website edit planner for small business sites driven by siteConfig.ts and a section-loop page.tsx.

Return ONLY valid JSON matching the schema. No markdown fences.

Skills (use the smallest set that satisfies the request):
${EDIT_SKILL_NAMES.map((s) => `- ${s}`).join('\n')}

Rules:
- Prefer config skills (update_hero, update_contact, update_business_name, update_section_copy) over custom_code_edit.
- update_section_copy: target sectionIndex or section type/title; params hold new copy, items, or fields.
- update_section_style: target sectionIndex; params.presentation or params.backgroundColor (color name → bg-{color}-200). Never use subtitle for styling.
- update_hero: params may include headline, subheadline, ctaLabel.
- update_contact: params phone, email, address.
- If the user request is vague, ambiguous, or could refer to multiple sections, set needsClarification true, steps [], clarificationQuestion, and suggestedReplies (2+ concrete options referencing section titles/types).
- When needsClarification is false, steps must be non-empty unless the request is impossible (then clarify instead).
- Do not invent facts not implied by the user message.`;

export function buildPlanEditSystemPrompt(): string {
  return PLANNER_SYSTEM;
}

export function buildPlanEditUserPrompt(siteModel: SiteModel, userPrompt: string): string {
  const structureMap =
    siteModel.structure != null
      ? formatStructureMap(siteModel.structure)
      : '(structure map unavailable)';

  const businessName = siteModel.parsedConfig?.businessName ?? '(unknown)';
  const sectionSummaries = (siteModel.structure?.sections ?? [])
    .map(
      (s) =>
        `[${s.index}] type=${s.type} title="${s.title}" renderer=${s.rendererComponent} items=${s.itemCount}`
    )
    .join('\n');

  const contact = siteModel.parsedConfig?.contact;
  const contactLine = contact
    ? `phone=${contact.phone ?? '—'} email=${contact.email ?? '—'} address=${contact.address ?? '—'}`
    : '(no contact parsed)';

  return `Business: ${businessName}
Archetype: ${siteModel.archetype}
Contact: ${contactLine}

Sections:
${sectionSummaries || '(none)'}

Structure map:
${structureMap}

User request:
${userPrompt.trim()}`;
}
