import { expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { runWebsiteEditAgentV2 } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { llmDescribe } from './llmIntegrationHarness';

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-v2-llm-e2e-'));
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'src/lib/siteConfig.ts'),
    `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: { phone: '555-0100', email: 'hello@example.com' },
  sections: [{ type: 'services', title: 'Services', items: [] }],
};`,
    'utf-8'
  );
  await fs.writeFile(
    path.join(dir, 'src/app/page.tsx'),
    `const preset = { pageBg: "bg-white", heroBg: "bg-white", surfaceBg: "bg-white" };
export default function Home() {
  return <main className={preset.pageBg}>Hello</main>;
}`,
    'utf-8'
  );
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body { background: white; }', 'utf-8');
  return dir;
}

llmDescribe('Website Agent V2 live E2E', () => {
  it('adds a service through the live planner and config executor', async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Add Emergency Repairs as a service with description "Fast urgent repairs"',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('Emergency Repairs');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('updates a phone number through the live planner and config executor', async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Update the phone number to 555-0199',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('555-0199');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('routes a theme/style request through V2 or its legacy wrapper', async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Change the background from white to blue',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.v2Meta?.skills?.some((skill) => skill === 'update_theme' || skill === 'legacy_strategy')).toBe(true);

    await fs.rm(dir, { recursive: true, force: true });
  });
});

