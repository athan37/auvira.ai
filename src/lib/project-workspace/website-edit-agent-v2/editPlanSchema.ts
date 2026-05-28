import type { JSONSchemaType } from 'ajv';

export type V2PlanIntent =
  | 'copy'
  | 'section'
  | 'contact'
  | 'style'
  | 'image'
  | 'clarification'
  | 'general';

export type V2PlanRoute =
  | 'hero'
  | 'sections'
  | 'contact'
  | 'theme'
  | 'images'
  | 'legacy'
  | 'clarify';

export type V2PlanConfidence = 'high' | 'medium' | 'low';

export type V2SkillName =
  | 'update_hero'
  | 'update_contact'
  | 'add_service'
  | 'add_section'
  | 'update_section_style'
  | 'update_theme'
  | 'update_image'
  | 'legacy_strategy'
  | 'clarify';

export interface EditPlanStep {
  skill: V2SkillName;
  reason?: string;
  args: Record<string, unknown>;
}

export interface EditPlan {
  planVersion: 'website-agent-v2';
  intent: V2PlanIntent;
  route: V2PlanRoute;
  confidence: V2PlanConfidence;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  suggestedReplies?: string[];
  summary?: string;
  steps: EditPlanStep[];
}

export const EDIT_PLAN_SCHEMA: JSONSchemaType<EditPlan> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    planVersion: { type: 'string', const: 'website-agent-v2' },
    intent: {
      type: 'string',
      enum: ['copy', 'section', 'contact', 'style', 'image', 'clarification', 'general'],
    },
    route: {
      type: 'string',
      enum: ['hero', 'sections', 'contact', 'theme', 'images', 'legacy', 'clarify'],
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    needsClarification: { type: 'boolean', nullable: true },
    clarificationQuestion: { type: 'string', nullable: true },
    suggestedReplies: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
    summary: { type: 'string', nullable: true },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skill: {
            type: 'string',
            enum: [
              'update_hero',
              'update_contact',
              'add_service',
              'add_section',
              'update_section_style',
              'update_theme',
              'update_image',
              'legacy_strategy',
              'clarify',
            ],
          },
          reason: { type: 'string', nullable: true },
          args: {
            type: 'object',
            required: [],
            additionalProperties: true,
          },
        },
        required: ['skill', 'args'],
      },
    },
  },
  required: ['planVersion', 'intent', 'route', 'confidence', 'steps'],
};

