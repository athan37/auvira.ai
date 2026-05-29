import Ajv from 'ajv';
import { getLLMClient } from '@/lib/llm/llmClient';
import type { LLMProvider } from '@/lib/llm/types';
import { formatConversationForIntentClarifier } from '@/lib/chat/conversationContextForEdit';
import type { ConversationTurn, WebsiteEditAgentOptions } from '../website-edit-agent/types';
import { EDIT_PLAN_SCHEMA, type EditPlan } from './editPlanSchema';
import { normalizeEditPlanSectionStyles } from './normalizeSectionStyleStep';
import { buildSiteModel, summarizeSiteModel, type SiteModel } from './siteModel';

const ajv = new Ajv({ allErrors: true });
const validateEditPlan = ajv.compile<EditPlan>(EDIT_PLAN_SCHEMA);

export interface PlanEditOptions {
  llm?: LLMProvider;
  siteModel?: SiteModel;
}

function formatConversation(
  ownerMessage: string,
  history: ConversationTurn[] | undefined
): string {
  if (!history?.length) return 'No prior conversation.';
  return formatConversationForIntentClarifier(ownerMessage, history)
    .replace(/^CONVERSATION CONTEXT[^\n]*\n/, '')
    .trim();
}

function describeValidationErrors(): string {
  return (validateEditPlan.errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
    .slice(0, 600);
}

function normalizePlan(plan: EditPlan): EditPlan {
  if (plan.needsClarification) {
    return {
      ...plan,
      intent: 'clarification',
      route: 'clarify',
      confidence: plan.confidence === 'high' ? 'medium' : plan.confidence,
      steps: plan.steps.length > 0 ? plan.steps : [{ skill: 'clarify', args: {} }],
    };
  }

  return plan;
}

/**
 * Ask the configured LLM to produce a V2 edit plan for a website edit request.
 */
export async function planEdit(
  options: WebsiteEditAgentOptions,
  planOptions: PlanEditOptions = {}
): Promise<EditPlan> {
  const siteModel = planOptions.siteModel ?? (await buildSiteModel(options));
  const llm = planOptions.llm ?? getLLMClient();

  const result = await llm.generateJSON<EditPlan>({
    system: `You are Website Agent V2's planner. Produce a safe, minimal JSON edit plan.

Rules:
- Return only JSON matching the provided schema.
- Prefer V2-native config skills when Config skills available is yes.
- Route hero headline/subheadline/tagline copy to update_hero.
- Route phone/email/address changes to update_contact.
- Route requests to add a service offering to add_service.
- Route one-section background/card/text styling to update_section_style (siteConfig presentation tokens), not subtitle hacks.
- update_section_style MUST include sectionIndex (number) AND either backgroundColor (color name) or presentation.{backgroundClass|cardClass}.
- For testimonial/service card colors use presentation.cardClass (e.g. border-red-300 bg-red-50), not subtitle.
- Ask for clarification when the user does not provide the new value or the target is ambiguous.
- Do not invent phone numbers, addresses, emails, business facts, testimonials, or prices.
- Use legacy_strategy only for edits not covered by V2 skills, such as broad layout code changes.`,
    prompt: `Owner request:
${options.ownerMessage}

Recent conversation:
${formatConversation(options.ownerMessage, options.conversationHistory)}

Site model:
${summarizeSiteModel(siteModel)}

Return an EditPlan. Keep args explicit and minimal. Examples:
- update_hero args: { "field": "headline", "value": "..." }
- update_contact args: { "field": "phone", "value": "..." }
- add_service args: { "title": "...", "description": "..." }
- add_section args: { "type": "generic", "title": "...", "body": "..." }
- update_section_style args: { "sectionIndex": 2, "backgroundColor": "yellow" }
- update_section_style card args: { "sectionIndex": 3, "presentation": { "cardClass": "border-red-300 bg-red-50" } }
- update_theme args: { "scope": "site|hero|section", "color": "blue" }
- legacy_strategy args: { "reason": "..." }`,
    schema: EDIT_PLAN_SCHEMA,
    temperature: 0.1,
    maxTokens: 1600,
  });

  if (!result.ok || !result.data || !validateEditPlan(result.data)) {
    throw new Error(`Website Agent V2 planner returned an invalid plan: ${describeValidationErrors() || 'invalid JSON'}`);
  }

  const normalized = normalizePlan(result.data);
  return normalizeEditPlanSectionStyles(normalized, options.ownerMessage, siteModel);
}

