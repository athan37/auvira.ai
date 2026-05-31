import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

function coerceSectionIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export const UpdateHeroParamsSchema = z
  .object({
    value: nonEmptyString.optional(),
    headline: nonEmptyString.optional(),
    subheadline: nonEmptyString.optional(),
    tagline: nonEmptyString.optional(),
    field: z.string().optional(),
  })
  .refine(
    (p) =>
      Boolean(p.value ?? p.headline ?? p.subheadline ?? p.tagline),
    { message: 'update_hero requires value (or headline/subheadline/tagline)' }
  );

export const UpdateBusinessNameParamsSchema = z.object({
  value: nonEmptyString,
  businessName: nonEmptyString.optional(),
});

export const UpdateSectionCopyParamsSchema = z
  .object({
    sectionIndex: z.union([z.number(), z.string()]).optional(),
    value: nonEmptyString.optional(),
    title: nonEmptyString.optional(),
    body: nonEmptyString.optional(),
    field: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    const idx = coerceSectionIndex(p.sectionIndex);
    if (idx == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'update_section_copy requires sectionIndex' });
    }
    if (!p.value && !p.title && !p.body) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'update_section_copy requires value' });
    }
  });

export const UpdateSectionStyleParamsSchema = z
  .object({
    sectionIndex: z.union([z.number(), z.string()]).optional(),
    backgroundClass: z.string().optional(),
    backgroundColor: z.string().optional(),
    color: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    const idx = coerceSectionIndex(p.sectionIndex);
    if (idx == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'update_section_style requires sectionIndex' });
    }
    if (!p.backgroundClass?.trim() && !p.backgroundColor?.trim() && !p.color?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'update_section_style requires backgroundClass or backgroundColor',
      });
    }
  });

export const UpdateContactParamsSchema = z
  .object({
    field: z.string().optional(),
    value: nonEmptyString.optional(),
    phone: nonEmptyString.optional(),
    email: nonEmptyString.optional(),
    address: nonEmptyString.optional(),
  })
  .refine(
    (p) => Boolean(p.value ?? p.phone ?? p.email ?? p.address),
    { message: 'update_contact requires value' }
  );

export const RemoveSectionParamsSchema = z
  .object({
    sectionIndex: z.union([z.number(), z.string()]).optional(),
  })
  .superRefine((p, ctx) => {
    if (coerceSectionIndex(p.sectionIndex) == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'remove_section requires sectionIndex' });
    }
  });

export const ReorderSectionsParamsSchema = z
  .object({
    order: z.array(z.union([z.number(), z.string()])).optional(),
    sectionOrder: z.array(z.union([z.number(), z.string()])).optional(),
    indices: z.array(z.union([z.number(), z.string()])).optional(),
    fromIndex: z.union([z.number(), z.string()]).optional(),
    toIndex: z.union([z.number(), z.string()]).optional(),
  })
  .refine(
    (p) => {
      const order = p.order ?? p.sectionOrder ?? p.indices;
      if (Array.isArray(order) && order.length > 0) return true;
      return coerceSectionIndex(p.fromIndex) != null && coerceSectionIndex(p.toIndex) != null;
    },
    { message: 'reorder_sections requires order or fromIndex and toIndex' }
  );

export const SKILL_PARAM_SCHEMAS: Record<string, z.ZodTypeAny> = {
  update_hero: UpdateHeroParamsSchema,
  update_business_name: UpdateBusinessNameParamsSchema,
  update_section_copy: UpdateSectionCopyParamsSchema,
  update_section_style: UpdateSectionStyleParamsSchema,
  update_contact: UpdateContactParamsSchema,
  remove_section: RemoveSectionParamsSchema,
  reorder_sections: ReorderSectionsParamsSchema,
};

/** Merge step target + params for semantic validation. */
export function mergedStepParams(
  target: Record<string, unknown> | undefined,
  params: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(target ?? {}), ...(params ?? {}) };
}
