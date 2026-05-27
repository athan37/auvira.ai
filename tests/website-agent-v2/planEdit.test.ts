import { describe, expect, it, vi } from 'vitest';
import { planEdit } from '../../src/lib/project-workspace/website-edit-agent-v2';
import type { SiteModel } from '../../src/lib/project-workspace/website-edit-agent-v2';

const SITE_MODEL: SiteModel = {
  mode: 'gitlab',
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: { phone: '555-0100' },
  sections: [{ index: 0, type: 'services', title: 'Services', itemCount: 0, items: [] }],
  files: [],
  capabilities: {
    hasSiteConfig: true,
    hasPage: true,
    hasGlobalsCss: false,
    supportsConfigSkills: true,
  },
};

describe('Website Agent V2 planEdit', () => {
  it('validates and returns an LLM edit plan', async () => {
    const llm = {
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          planVersion: 'website-agent-v2',
          intent: 'contact',
          route: 'contact',
          confidence: 'high',
          steps: [{ skill: 'update_contact', args: { field: 'phone', value: '555-0199' } }],
          summary: 'Update the phone number.',
        },
      }),
    };

    const plan = await planEdit(
      {
        workspacePath: '/tmp/not-read',
        ownerMessage: 'Change the phone number to 555-0199',
        projectId: 'test',
        mode: 'gitlab',
      },
      { llm, siteModel: SITE_MODEL }
    );

    expect(plan.route).toBe('contact');
    expect(plan.steps[0]).toMatchObject({
      skill: 'update_contact',
      args: { field: 'phone', value: '555-0199' },
    });
  });

  it('rejects invalid LLM plans', async () => {
    const llm = {
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          planVersion: 'website-agent-v2',
          intent: 'contact',
          route: 'contact',
          confidence: 'high',
          steps: [{ skill: 'delete_everything', args: {} }],
        },
      }),
    };

    await expect(
      planEdit(
        {
          workspacePath: '/tmp/not-read',
          ownerMessage: 'Change the phone number',
          projectId: 'test',
          mode: 'gitlab',
        },
        { llm, siteModel: SITE_MODEL }
      )
    ).rejects.toThrow(/invalid plan/i);
  });
});

