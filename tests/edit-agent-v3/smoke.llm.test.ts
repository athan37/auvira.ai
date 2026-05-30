import { describe, it, expect } from 'vitest';
import { describeRunLlmIntegration } from '../llmTestGate';
import { runWebsiteEditAgentV3 } from '@/lib/project-workspace/edit-agent-v3';
import { createSyntheticWorkspace } from '../support/syntheticSiteWorkspace';

describeRunLlmIntegration('edit-agent-v3 smoke (LLM)', () => {
  it('Make contact section red — routes or clarifies', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Services' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: 'Make contact section red',
      projectId: 'v3-smoke-contact-red',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification || result.ok).toBe(true);
  });

  it('Change phone to (713) 555-0199', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'contact', title: 'Contact' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: 'Change phone to (713) 555-0199',
      projectId: 'v3-smoke-phone',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.summary).toContain('555-0199');
  });

  it('Make that section better — asks clarification', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'services', title: 'Services' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: 'Make that section better',
      projectId: 'v3-smoke-vague',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification || !result.ok).toBe(true);
  });

  it('Add Emergency AC Repair to services', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'services', title: 'Our Services' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: 'Add Emergency AC Repair to services',
      projectId: 'v3-smoke-add-service',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);
  });
});
