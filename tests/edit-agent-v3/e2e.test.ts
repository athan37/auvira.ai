import { describe, it, expect } from 'vitest';
import { runWebsiteEditAgentV3 } from '@/lib/project-workspace/edit-agent-v3';
import { createSyntheticWorkspace, readSyntheticFile } from '../support/syntheticSiteWorkspace';

describe('runWebsiteEditAgentV3', () => {
  it('applies section background via deterministic plan', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Everything You Need to Grow Your Business' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage:
        'change this section background to color gradient "Everything You Need to Grow Your Business"',
      projectId: 'v3-gradient-test',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.summary).toMatch(/Everything You Need to Grow Your Business/i);
    expect(result.summary).toMatch(/gradient/);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('backgroundClass');
    const contactSection = siteConfig.indexOf('Get Started Today');
    const servicesSection = siteConfig.indexOf('Everything You Need to Grow Your Business');
    expect(servicesSection).toBeGreaterThan(-1);
    expect(siteConfig.slice(servicesSection, servicesSection + 400)).toContain('gradient');
    void contactSection;
  });

  it('updates contact phone with source-of-truth summary', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'contact', title: 'Contact Us' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: 'Change phone to (713) 555-0199',
      projectId: 'v3-contact-test',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.summary).toContain('(713) 555-0199');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('(713) 555-0199');
  });
});
