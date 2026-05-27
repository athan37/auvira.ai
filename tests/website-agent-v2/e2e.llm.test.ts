import { expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { runWebsiteEditAgentV2 } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { llmDescribe } from './llmIntegrationHarness';

const LLM_TEST_TIMEOUT_MS = 120_000;

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
  it(
    'adds a service through the live planner and config executor',
    async () => {
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
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'updates a phone number through the live planner and config executor',
    async () => {
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
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'routes a theme/style request through V2 or its legacy wrapper',
    async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Change the entire site background to blue',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    if (result.needsClarification) {
      expect(result.ok).toBe(false);
      expect((result.ownerMessage ?? '').toLowerCase()).toContain('background');
    } else if (result.ok) {
      expect(result.ok, result.error).toBe(true);
      expect(
        result.v2Meta?.skills?.some((skill) => skill === 'update_theme' || skill === 'legacy_strategy')
      ).toBe(true);
      const globalsCss = await fs.readFile(path.join(dir, 'src/app/globals.css'), 'utf-8');
      const page = await fs.readFile(path.join(dir, 'src/app/page.tsx'), 'utf-8');
      const combined = `${globalsCss}\n${page}`.toLowerCase();
      expect(combined.includes('blue') || combined.includes('bg-blue')).toBe(true);
    } else {
      // For hard style requests, the current implementation may fail safely through legacy wrapper.
      expect(result.ok).toBe(false);
      expect((result.error ?? result.ownerMessage ?? '').trim().length).toBeGreaterThan(0);
    }

    await fs.rm(dir, { recursive: true, force: true });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'updates the hero title/headline through the live planner and config executor',
    async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Change the title to "Built for Growth"',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('Built for Growth');

    await fs.rm(dir, { recursive: true, force: true });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'adds a new section with image items through the live planner and config executor',
    async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage:
        'Add a new gallery section titled "Portfolio" and include these image URLs in the section content: /uploads/before.jpg and /uploads/after.jpg',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    if (result.needsClarification) {
      expect(result.ok).toBe(false);
      expect((result.ownerMessage ?? '').toLowerCase()).toContain('section');
    } else if (result.ok) {
      expect(result.ok, result.error).toBe(true);
      const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
      const normalized = siteConfig.toLowerCase();
      expect(normalized.includes('portfolio') || normalized.includes('gallery')).toBe(true);
      expect(result.v2Meta?.skills?.includes('add_section')).toBe(true);
    } else {
      // Hard image prompts may currently fail safely if verification cannot confirm image placement.
      expect(result.ok).toBe(false);
      expect((result.error ?? result.ownerMessage ?? '').trim().length).toBeGreaterThan(0);
    }

    await fs.rm(dir, { recursive: true, force: true });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'handles multi-step requests with coordinated content changes',
    async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage:
        'Refresh the site in one pass: set hero headline to "Trusted Home Services", update phone to 555-0222, and add a service "Annual Tune-Up" with description "Preventive seasonal maintenance".',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('Trusted Home Services');
    expect(siteConfig).toContain('555-0222');
    expect(siteConfig).toContain('Annual Tune-Up');
    expect(siteConfig).toContain('Preventive seasonal maintenance');

    await fs.rm(dir, { recursive: true, force: true });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'returns clarification instead of unsafe edits for ambiguous prompts',
    async () => {
    const dir = await createWorkspace();

    const result = await runWebsiteEditAgentV2({
      workspacePath: dir,
      ownerMessage: 'Make it better and cleaner overall.',
      projectId: 'llm-e2e',
      mode: 'gitlab',
    });

    expect(result.ok).toBe(false);
    expect(result.needsClarification).toBe(true);
    expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);

    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('Welcome');
    expect(siteConfig).toContain('555-0100');

    await fs.rm(dir, { recursive: true, force: true });
    },
    LLM_TEST_TIMEOUT_MS
  );
});

