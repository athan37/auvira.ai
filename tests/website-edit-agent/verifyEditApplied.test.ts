import { describe, it, expect } from 'vitest';
import { verifyEditApplied } from '../../src/lib/project-workspace/website-edit-agent/verifyEditApplied';

describe('verifyEditApplied', () => {
  it('fails when no files changed', () => {
    const r = verifyEditApplied('make background green', { 'a.css': 'x' }, { 'a.css': 'x' });
    expect(r.ok).toBe(false);
  });

  it('passes style change with color in css', () => {
    const r = verifyEditApplied(
      'make background blue',
      { 'globals.css': 'background: white' },
      { 'globals.css': 'background: blue' }
    );
    expect(r.ok).toBe(true);
  });

  it('fails section request without homepage content change', () => {
    const r = verifyEditApplied(
      'add a new section',
      { 'styles.css': 'a' },
      { 'styles.css': 'b' }
    );
    expect(r.ok).toBe(false);
  });

  it('passes section request when siteConfig sections grow', () => {
    const before = `export const siteConfig = { sections: [{ type: "about", title: "About", items: [] }] };`;
    const after = `${before.slice(0, -2)}, { type: "faq", title: "FAQ", items: [
      { title: "What services do you offer?", description: "We offer HVAC and plumbing." },
      { title: "Do you offer same-day service?", description: "Yes, when available." },
      { title: "How do I book?", description: "Call or use our online form." }
    }] }; };`;

    const r = verifyEditApplied(
      'add an FAQ section with 3 questions',
      { 'src/lib/siteConfig.ts': before },
      { 'src/lib/siteConfig.ts': after }
    );
    expect(r.ok).toBe(true);
  });

  it('passes section request when siteConfig sections shrink but change meaningfully', () => {
    const before = `export const siteConfig = { sections: [{ type: "testimonials", title: "Reviews", items: [
      { title: "A", description: "${'long quote '.repeat(20)}" },
      { title: "B", description: "${'long quote '.repeat(20)}" }
    ] }] };`;
    const after = `export const siteConfig = { sections: [{ type: "testimonials", title: "Reviews", items: [
      { title: "Jordan Lee", description: "Great service and clear communication." },
      { title: "Maria Santos", description: "Professional team from start to finish." }
    ] }] };`;

    const r = verifyEditApplied(
      'add a testimonials section with 2 short customer quotes',
      { 'src/lib/siteConfig.ts': before },
      { 'src/lib/siteConfig.ts': after }
    );
    expect(r.ok).toBe(true);
  });
});
