import { describe, it, expect, afterEach } from 'vitest';
import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import { setupTestWorkspace } from './setupTestWorkspace';

describe('Website Agent V2 — SiteModel (integration)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('builds section_loop model from fixture workspace', async () => {
    const ws = await setupTestWorkspace();
    cleanup = ws.cleanup;

    const model = await getSiteModel({
      workspacePath: ws.workspacePath,
      gateway: ws.gateway,
      mode: 'gitlab',
    });

    expect(model.archetype).toBe('section_loop');
    expect(model.siteConfigPath).toBe('src/lib/siteConfig.ts');
    expect(model.pagePath).toBe('src/app/page.tsx');
    expect(model.parsedConfig?.businessName).toBe('Houston HVAC Pros');
    expect(model.parsedConfig?.contact?.phone).toContain('713');
    expect(model.parsedConfig?.sections.length).toBeGreaterThanOrEqual(3);
    expect(model.structure?.sections.length).toBe(model.parsedConfig?.sections.length);
    expect(model.structure?.rendersFromSiteConfig).toBe(true);
    expect(model.structure?.structureMap).toMatch(/services/i);
    expect(model.structure?.structureMap).toMatch(/about/i);
    expect(model.errors).toEqual([]);
  });
});
