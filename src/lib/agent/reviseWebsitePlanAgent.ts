import { getLLMClient } from '@/lib/llm/llmClient';
import { websitePlanSchema, type ScratchIntake, type WebsitePlan } from './schemas';

function buildReviseWebsitePlanPrompt(
  intake: ScratchIntake,
  currentPlan: WebsitePlan,
  revisionInstruction: string
): string {
  return `You are a senior website strategist revising an existing website plan based on owner feedback.

RULES:
- Preserve factual accuracy from the original intake — do not invent phone numbers, testimonials, awards, or credentials.
- Apply the revision instruction to positioning, section structure, CTAs, and copy direction where appropriate.
- Keep the same JSON schema as the original plan.
- If contact info is missing in intake, keep it in requiredMissingInfo — do not fabricate it.

ORIGINAL INTAKE:
- Business Name: ${intake.businessName}
- Industry: ${intake.industry}
- Location: ${intake.location || 'Not provided'}
- Services: ${intake.services || 'Not provided'}
- Target Customers: ${intake.targetCustomers || 'Not provided'}
- Main Goal: ${intake.mainGoal || 'Not provided'}
- Phone: ${intake.phone || 'Not provided'}
- Email: ${intake.email || 'Not provided'}
- Notes: ${intake.notes || 'None'}
- Desired Style: ${intake.desiredStyle || 'Not provided'}

CURRENT PLAN (JSON):
${JSON.stringify(currentPlan, null, 2)}

REVISION INSTRUCTION:
${revisionInstruction}

Return ONLY valid JSON matching the website plan schema.`;
}

/** Revise an existing scratch WebsitePlan from natural-language owner feedback. */
export async function reviseWebsitePlanAgent(
  intake: ScratchIntake,
  currentPlan: WebsitePlan,
  revisionInstruction: string
): Promise<{ data: WebsitePlan; stageLogs: Array<{ stage: string; timestamp: string; duration_ms?: number }> }> {
  const startTime = Date.now();
  const stageLogs: Array<{ stage: string; timestamp: string; duration_ms?: number }> = [];

  stageLogs.push({ stage: 'plan_revision_start', timestamp: new Date().toISOString() });

  const llmClient = getLLMClient();
  const prompt = buildReviseWebsitePlanPrompt(intake, currentPlan, revisionInstruction);

  const result = await llmClient.generateJSON({
    system:
      "You are a senior website strategist revising a website plan. Improve structure and messaging per the revision instruction without inventing factual claims. Return ONLY JSON matching the schema.",
    prompt,
    schema: websitePlanSchema,
  });

  stageLogs.push({
    stage: 'plan_revision_done',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
  });

  return { data: result.data as WebsitePlan, stageLogs };
}
