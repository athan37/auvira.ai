import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { repairSectionPresentationWiringInWorkspace } from '@/lib/project-workspace/edit-shared/legacySectionPresentation';

const LEGACY_PAGE = `function GallerySection({ section }) {
  return <section className={"py-20 " + preset.mutedBg}>{section.title}</section>;
}
export default function Home() { return <GallerySection section={siteConfig.sections[0]} />; }`;

const SITE_CONFIG = `export const siteConfig = {
  sections: [{ type: "gallery", title: "Hello this is david" }],
};`;

const TAILWIND = `module.exports = { content: ["./src/app/**/*"] };`;

describe('repairSectionPresentationWiringInWorkspace', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = scratchPath('presentation-wiring-test', `${Date.now()}`);
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'src/app/page.tsx'), LEGACY_PAGE, 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), SITE_CONFIG, 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'tailwind.config.js'), TAILWIND, 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('wires gallery renderer to resolveSectionBackground and repairs tailwind safelist', async () => {
    const repaired = await repairSectionPresentationWiringInWorkspace(workspacePath);
    expect(repaired).toContain('src/app/page.tsx');
    expect(repaired).toContain('tailwind.config.js');

    const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
    expect(page).toContain('resolveSectionBackground(section, preset)');

    const tailwind = await fs.readFile(path.join(workspacePath, 'tailwind.config.js'), 'utf-8');
    expect(tailwind).toContain('safelist');
    expect(tailwind).toContain('./src/**/*');
  });
});
