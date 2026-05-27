import { describe, expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { executePlan } from '../../src/lib/project-workspace/website-edit-agent-v2';
import type { EditPlan } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { computeWorkspaceHashes } from '../../src/lib/project-workspace/workspaceEditShared';

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-v2-exec-'));
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'src/lib/siteConfig.ts'),
    `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: { phone: '555-0100' },
  sections: [{ type: 'services', title: 'Services', items: [] }],
};`,
    'utf-8'
  );
  return dir;
}

describe('Website Agent V2 executePlan', () => {
  it('executes add_service as a config-native skill', async () => {
    const dir = await createWorkspace();
    const plan: EditPlan = {
      planVersion: 'website-agent-v2',
      intent: 'section',
      route: 'sections',
      confidence: 'high',
      steps: [
        {
          skill: 'add_service',
          args: { title: 'Emergency Repairs', description: 'Fast help for urgent issues' },
        },
      ],
      summary: 'Added Emergency Repairs to services.',
    };

    const options = {
      workspacePath: dir,
      ownerMessage: 'Add Emergency Repairs as a service',
      projectId: 'test',
      mode: 'gitlab' as const,
    };
    const before = await computeWorkspaceHashes(dir);
    const result = await executePlan(plan, options, before);

    expect(result.ok, result.error).toBe(true);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('Emergency Repairs');
    expect(siteConfig).toContain('Fast help for urgent issues');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns clarification without changing files', async () => {
    const dir = await createWorkspace();
    const plan: EditPlan = {
      planVersion: 'website-agent-v2',
      intent: 'clarification',
      route: 'clarify',
      confidence: 'low',
      needsClarification: true,
      clarificationQuestion: 'What phone number should I use?',
      suggestedReplies: ['Use 555-0199'],
      steps: [{ skill: 'clarify', args: {} }],
    };

    const result = await executePlan(plan, {
      workspacePath: dir,
      ownerMessage: 'Change phone number',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok).toBe(false);
    expect(result.needsClarification).toBe(true);
    expect(result.ownerMessage).toBe('What phone number should I use?');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('delegates theme edits through the legacy wrapper', async () => {
    const root = path.join(process.cwd(), '.tmp/git-workspaces');
    await fs.mkdir(root, { recursive: true });
    const dir = await fs.mkdtemp(path.join(root, 'ws-v2-legacy-'));
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/app/page.tsx'),
      `const preset = { pageBg: "bg-white", heroBg: "bg-white", surfaceBg: "bg-white" };
export default function Home() {
  return <main className={preset.pageBg}>Hello</main>;
}`,
      'utf-8'
    );
    await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body { background: white; }', 'utf-8');
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: {},
  sections: [],
};`,
      'utf-8'
    );
    const before = await computeWorkspaceHashes(dir);
    const plan: EditPlan = {
      planVersion: 'website-agent-v2',
      intent: 'style',
      route: 'theme',
      confidence: 'medium',
      steps: [{ skill: 'update_theme', args: { scope: 'site', color: 'blue' } }],
      summary: 'Updated the site theme.',
    };

    const result = await executePlan(
      plan,
      {
        workspacePath: dir,
        ownerMessage: 'Change the background from white to blue',
        projectId: 'test',
        mode: 'gitlab',
      },
      before
    );

    expect(result.ok, result.error).toBe(true);
    expect(result.v2Meta?.usedLegacyWrapper).toBe(true);
    const page = await fs.readFile(path.join(dir, 'src/app/page.tsx'), 'utf-8');
    expect(page).toContain('blue');

    await fs.rm(dir, { recursive: true, force: true });
  });
});

