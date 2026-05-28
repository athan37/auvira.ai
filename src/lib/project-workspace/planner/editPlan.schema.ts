import { z } from 'zod';

/** Skills the V2 planner may emit (executor support varies by chunk). */
export const EDIT_SKILL_NAMES = [
  'update_hero',
  'update_contact',
  'update_business_name',
  'update_section_copy',
  'update_theme',
  'update_section_style',
  'add_section',
  'remove_section',
  'reorder_sections',
  'replace_image',
  'custom_code_edit',
] as const;

export type EditSkillName = (typeof EDIT_SKILL_NAMES)[number];

export const EditStepSchema = z.object({
  skill: z.enum(EDIT_SKILL_NAMES),
  target: z.record(z.unknown()).optional(),
  params: z.record(z.unknown()).optional(),
  rationale: z.string().optional(),
});

export type EditStep = z.infer<typeof EditStepSchema>;

export const EditPlanSchema = z
  .object({
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().optional(),
    suggestedReplies: z.array(z.string()).optional(),
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

/** JSON Schema for LLM structured output (no zod-to-json-schema dependency). */
export const EDIT_PLAN_JSON_SCHEMA: object = {
  type: 'object',
  required: ['needsClarification', 'steps'],
  properties: {
    needsClarification: { type: 'boolean' },
    clarificationQuestion: { type: 'string' },
    suggestedReplies: { type: 'array', items: { type: 'string' } },
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
