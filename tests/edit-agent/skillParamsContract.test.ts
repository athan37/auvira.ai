import { describe, expect, it } from 'vitest';
import { skillToDomainTool } from '@/lib/project-workspace/tools/domain/registry';
import { SKILL_PARAM_SCHEMAS } from '@/lib/project-workspace/planner/editStepParams.schema';

const EXECUTABLE_SKILLS = [
  'update_hero',
  'update_contact',
  'update_business_name',
  'update_section_copy',
  'update_section_style',
  'remove_section',
  'reorder_sections',
] as const;

describe('skill × params contract matrix', () => {
  it.each(EXECUTABLE_SKILLS)('%s maps to a domain tool and has param schema', (skill) => {
    expect(skillToDomainTool(skill)).toBeTruthy();
    expect(SKILL_PARAM_SCHEMAS[skill]).toBeDefined();
  });

  it('valid minimal params parse for each skill schema', () => {
    const samples: Record<string, Record<string, unknown>> = {
      update_hero: { value: 'New headline', field: 'headline' },
      update_contact: { field: 'phone', value: '(713) 555-0100' },
      update_business_name: { value: 'Acme LLC' },
      update_section_copy: { sectionIndex: 0, field: 'title', value: 'New' },
      update_section_style: { sectionIndex: 0, backgroundClass: 'bg-gradient-to-r from-blue-500' },
      remove_section: { sectionIndex: 1 },
      reorder_sections: { order: [1, 0] },
    };

    for (const skill of EXECUTABLE_SKILLS) {
      const schema = SKILL_PARAM_SCHEMAS[skill];
      const parsed = schema.safeParse(samples[skill]);
      expect(parsed.success, `${skill}: ${JSON.stringify(parsed.success ? '' : parsed.error?.issues)}`).toBe(
        true
      );
    }
  });
});
