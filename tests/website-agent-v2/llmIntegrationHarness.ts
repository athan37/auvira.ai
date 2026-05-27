import { describe } from 'vitest';
import type { EditPlan, SiteModel } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { planEdit } from '../../src/lib/project-workspace/website-edit-agent-v2';

export const runLlmIntegrationTests = process.env.RUN_LLM_INTEGRATION_TESTS === 'true';
const hasMiniMaxKey = Boolean(process.env.MINIMAX_API_KEY?.trim());
export const llmDescribe = runLlmIntegrationTests && hasMiniMaxKey ? describe : describe.skip;

export const BASE_SITE_MODEL: SiteModel = {
  mode: 'gitlab',
  businessName: 'Loop Co',
  hero: {
    headline: 'Welcome to Loop Co',
    subheadline: 'We help local businesses grow',
  },
  contact: {
    phone: '555-0100',
    email: 'hello@example.com',
  },
  sections: [
    {
      index: 0,
      type: 'services',
      title: 'Services',
      itemCount: 1,
      items: [{ title: 'Consulting', description: 'Planning support' }],
    },
    {
      index: 1,
      type: 'about',
      title: 'About',
      body: 'A local team',
      itemCount: 0,
      items: [],
    },
  ],
  files: [],
  capabilities: {
    hasSiteConfig: true,
    hasPage: true,
    hasGlobalsCss: true,
    supportsConfigSkills: true,
  },
};

/**
 * Run the real V2 planner against the configured LLM provider.
 */
export async function planWithLiveLlm(ownerMessage: string): Promise<EditPlan> {
  return planEdit(
    {
      workspacePath: '/tmp/not-read',
      ownerMessage,
      projectId: 'llm-integration',
      mode: 'gitlab',
    },
    { siteModel: BASE_SITE_MODEL }
  );
}

