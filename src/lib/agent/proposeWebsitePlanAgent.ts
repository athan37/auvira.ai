import { getLLMClient } from '@/lib/llm/llmClient';
import { websitePlanSchema, type ScratchIntake } from './schemas';

function buildProposeWebsitePlanPrompt(intake: ScratchIntake): string {
  return `You are a senior website strategist for small businesses. Create a practical website plan from the user's business description.

RULES:
- Do not invent fake phone numbers, emails, addresses, testimonials, awards, certifications, years of experience, or guarantees.
- If contact info (phone, email, address) is missing or blank, add it to "requiredMissingInfo" — do NOT fabricate it.
- Do not create fake testimonials. If the user did not provide testimonials, do not include testimonials in the plan.
- Do not claim experience/awards/ratings unless explicitly provided by the user.
- Only include services that were actually mentioned by the user.
- Contact info in the plan must only come from what the user provided.
- If information is missing, list it in "requiredMissingInfo" or "optionalMissingInfo".

USER INTAKE:
- Business Name: ${intake.businessName || 'Not provided'}
- Industry: ${intake.industry || 'Not provided'}
- Location: ${intake.location || 'Not provided'}
- Services: ${intake.services || 'Not provided'}
- Target Customers: ${intake.targetCustomers || 'Not provided'}
- Main Goal: ${intake.mainGoal || 'Not provided'}
- Phone: ${intake.phone || 'Not provided'}
- Email: ${intake.email || 'Not provided'}
- Address: ${intake.address || 'Not provided'}
- Desired Style: ${intake.desiredStyle || 'Not provided'}
- Notes: ${intake.notes || 'None'}

OUTPUT:
Return ONLY valid JSON matching this schema:
{
  "businessName": string,
  "industry": string,
  "positioning": string (2-3 sentence positioning statement),
  "targetCustomers": string[],
  "primaryGoal": string,
  "recommendedPagesOrSections": [{ name, type, priority, purpose }],
  "contentPlan": {
    "hero": { headline, subheadline, primaryCTA, secondaryCTA },
    "sections": [{ type, title, purpose, contentNotes }]
  },
  "requiredMissingInfo": string[],
  "optionalMissingInfo": string[],
  "suggestedTemplate": { category: string, variant: string, reason: string },
  "riskWarnings": string[]
}

IMPORTANT: The "category" and "variant" are different fields.
- "category" is: legal | healthcare | home-services | restaurant | general-service
- "variant" is: premium-professional | local-service-pro | healthcare-calm | restaurant-warm | modern-clean

Map industry to BOTH category AND variant:
- law/attorney/legal → category: "legal", variant: "premium-professional"
- medical/health/doctor/clinic → category: "healthcare", variant: "healthcare-calm"
- cleaning/plumbing/hvac/roof/electric/contractor → category: "home-services", variant: "local-service-pro"
- restaurant/food/café → category: "restaurant", variant: "restaurant-warm"
- other → category: "general-service", variant: "modern-clean"`;
}

export async function proposeWebsitePlanAgent(
  intake: ScratchIntake
): Promise<{ data: unknown; stageLogs: Array<{ stage: string; timestamp: string; duration_ms?: number }> }> {
  const startTime = Date.now();
  const stageLogs: Array<{ stage: string; timestamp: string; duration_ms?: number }> = [];

  stageLogs.push({ stage: 'plan_proposal_start', timestamp: new Date().toISOString() });

  const llmClient = getLLMClient();

  const prompt = buildProposeWebsitePlanPrompt(intake);

  try {
    const result = await llmClient.generateJSON({
      system: "You are a senior website strategist for small businesses. Create a practical website plan from the user's business description. You may improve positioning and structure, but you must not invent factual claims. Return ONLY JSON matching the schema.",
      prompt,
      schema: websitePlanSchema,
    });

    stageLogs.push({ stage: 'plan_proposal_done', timestamp: new Date().toISOString(), duration_ms: Date.now() - startTime });

    return { data: result.data, stageLogs };
  } catch (error) {
    stageLogs.push({ stage: 'plan_proposal_failed', timestamp: new Date().toISOString(), duration_ms: Date.now() - startTime });
    throw error;
  }
}