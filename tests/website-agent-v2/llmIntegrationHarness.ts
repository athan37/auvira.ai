import type { EditPlan, SiteModel } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { planEdit } from '../../src/lib/project-workspace/website-edit-agent-v2';
import type { ConversationTurn } from '../../src/lib/project-workspace/website-edit-agent/types';
import { hasLlmApiKey, llmDescribe } from '../llmTestGate';

export { hasLlmApiKey, llmDescribe };
export const runLlmIntegrationTests = hasLlmApiKey();

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
    {
      index: 2,
      type: 'gallery',
      title: 'Hello',
      body: 'Project photos',
      itemCount: 1,
      items: [{ title: 'Project A', imageUrl: '/uploads/a.jpg' }],
    },
    {
      index: 3,
      type: 'testimonials',
      title: 'What Our Customers Say',
      itemCount: 2,
      items: [
        { title: 'Jordan Lee', description: 'Great service.' },
        { title: 'Maria Santos', description: 'Professional team.' },
      ],
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
export async function planWithLiveLlm(
  ownerMessage: string,
  siteModel: SiteModel = BASE_SITE_MODEL,
  conversationHistory?: ConversationTurn[]
): Promise<EditPlan> {
  return planEdit(
    {
      workspacePath: '/tmp/not-read',
      ownerMessage,
      projectId: 'llm-integration',
      mode: 'gitlab',
      conversationHistory,
    },
    { siteModel }
  );
}
