import { z } from 'zod';

/** Skills the V3 planner may emit (mapped to domain tools at execution). */
export const EDIT_SKILL_NAMES = [
  'update_hero',
  'update_contact',
  'update_business_name',
  'update_section_copy',
  'update_theme',
  'update_section_style',
  'add_section',
  'add_service',
  'remove_section',
  'reorder_sections',
  'replace_image',
  'custom_code_edit',
] as const;

export type EditSkillName = (typeof EDIT_SKILL_NAMES)[number];

export const EDIT_INTENT_NAMES = [
  'copy',
  'contact',
  'style',
  'section',
  'image',
  'theme',
  'clarification',
  'general',
] as const;

export type EditPlanIntent = (typeof EDIT_INTENT_NAMES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;

export const EditTargetSchema = z.object({
  kind: z.enum(['section', 'hero', 'nav', 'footer', 'site']).optional(),
  sectionIndex: z.number().optional(),
  sectionTitle: z.string().optional(),
  sectionType: z.string().optional(),
  field: z.string().optional(),
});

export type EditPlanTarget = z.infer<typeof EditTargetSchema>;

export const VerificationSpecSchema = z.object({
  kind: z.string(),
  sectionIndex: z.number().optional(),
  field: z.string().optional(),
  expectedValue: z.string().optional(),
  expectedPattern: z.string().optional(),
});

export const RiskSpecSchema = z.object({
  level: z.enum(RISK_LEVELS),
  reasons: z.array(z.string()).optional(),
});

export const EditStepSchema = z.object({
  skill: z.enum(EDIT_SKILL_NAMES),
  target: z.record(z.unknown()).optional(),
  params: z.record(z.unknown()).optional(),
  rationale: z.string().optional(),
});

export type EditStep = z.infer<typeof EditStepSchema>;

export const EditPlanSchema = z
  .object({
    planVersion: z.literal('website-agent-v3').optional(),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().optional(),
    suggestedReplies: z.array(z.string()).optional(),
    intent: z.enum(EDIT_INTENT_NAMES).optional(),
    targets: z.array(EditTargetSchema).optional(),
    verification: z.array(VerificationSpecSchema).optional(),
    risk: RiskSpecSchema.optional(),
    steps: z.array(EditStepSchema),
  })
  .superRefine((plan, ctx) => {
    if (plan.needsClarification) {
      if (plan.steps.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'steps must be empty when needsClarification is true',
          path: ['steps'],
        });
      }
      if (!plan.clarificationQuestion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'clarificationQuestion is required when needsClarification is true',
          path: ['clarificationQuestion'],
        });
      }
      const replyCount = plan.suggestedReplies?.filter((r) => r.trim()).length ?? 0;
      if (replyCount < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'suggestedReplies must include at least 2 non-empty strings when clarifying',
          path: ['suggestedReplies'],
        });
      }
    }
  });

export type EditPlan = z.infer<typeof EditPlanSchema>;

/** JSON Schema for LLM structured output. */
export const EDIT_PLAN_JSON_SCHEMA: object = {
  type: 'object',
  required: ['needsClarification', 'steps'],
  properties: {
    planVersion: { type: 'string', const: 'website-agent-v3' },
    needsClarification: { type: 'boolean' },
    clarificationQuestion: { type: 'string' },
    suggestedReplies: { type: 'array', items: { type: 'string' } },
    intent: { type: 'string', enum: [...EDIT_INTENT_NAMES] },
    targets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          sectionIndex: { type: 'number' },
          sectionTitle: { type: 'string' },
          sectionType: { type: 'string' },
          field: { type: 'string' },
        },
      },
    },
    verification: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          sectionIndex: { type: 'number' },
          field: { type: 'string' },
          expectedValue: { type: 'string' },
          expectedPattern: { type: 'string' },
        },
      },
    },
    risk: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: [...RISK_LEVELS] },
        reasons: { type: 'array', items: { type: 'string' } },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['skill'],
        properties: {
          skill: { type: 'string', enum: [...EDIT_SKILL_NAMES] },
          target: { type: 'object' },
          params: { type: 'object' },
          rationale: { type: 'string' },
        },
      },
    },
  },
};
