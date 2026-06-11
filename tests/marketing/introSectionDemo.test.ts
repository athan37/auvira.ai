import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { INTRO_NARRATIVE, type IntroDemoId } from '@/content/marketing';

const DEMO_IDS: IntroDemoId[] = [
  'teamsToChat',
  'memory',
  'describe',
  'cloneFromUrl',
  'dragToChat',
];

describe('intro section demos', () => {
  it('assigns a demo to every narrative section', () => {
    expect(INTRO_NARRATIVE).toHaveLength(5);
    for (const section of INTRO_NARRATIVE) {
      expect(DEMO_IDS).toContain(section.demo);
    }
  });

  it('maps narrative ids to expected demo keys', () => {
    const byId = Object.fromEntries(INTRO_NARRATIVE.map((s) => [s.id, s.demo]));
    expect(byId.why).toBe('teamsToChat');
    expect(byId.teammate).toBe('memory');
    expect(byId.websites).toBe('describe');
    expect(byId.clone).toBe('cloneFromUrl');
    expect(byId.vision).toBe('dragToChat');
  });

  it('implements IntroSectionDemo switch for all demo ids', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketing/intro-demos/IntroSectionDemo.tsx'),
      'utf8'
    );
    for (const id of DEMO_IDS) {
      expect(source).toContain(`'${id}'`);
    }
    expect(source).toContain('IntroTeamsDemo');
    expect(source).toContain('IntroMemoryDemo');
    expect(source).toContain('IntroDescribeDemo');
    expect(source).toContain('IntroCloneDemo');
    expect(source).toContain('IntroVisionEditDemo');
  });

  it('wires NarrativeSection to IntroSectionDemo', () => {
    const narrative = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketing/NarrativeSection.tsx'),
      'utf8'
    );
    expect(narrative).toContain('IntroSectionDemo');
    expect(narrative).toContain('section.demo');
    expect(narrative).not.toContain('ProductMock');
  });
});
