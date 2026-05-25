import { describe, it, expect } from 'vitest';
import { verifyEditApplied } from '../../src/lib/project-workspace/website-edit-agent/verifyEditApplied';

describe('verifyEditApplied', () => {
  it('fails when no files changed', () => {
    const r = verifyEditApplied('make background green', { 'a.css': 'x' }, { 'a.css': 'x' });
    expect(r.ok).toBe(false);
  });

  it('passes style change with color in css when no page.tsx preset', () => {
    const r = verifyEditApplied(
      'make background blue',
      { 'globals.css': 'background: white' },
      { 'globals.css': 'background: blue' }
    );
    expect(r.ok).toBe(true);
  });

  it('fails blue background when page.tsx still uses bg-red', () => {
    const page = `export default function Page() {
      const preset = { pageBg: "bg-red-600", heroBg: "bg-red-700" };
      return <main className={preset.pageBg}>Hero</main>;
    }`;
    const r = verifyEditApplied(
      'change background to blue',
      { 'src/app/page.tsx': page, 'src/app/globals.css': 'body {}' },
      {
        'src/app/page.tsx': page,
        'src/app/globals.css': '/* blue theme */ body { background: blue; }',
      }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/page\.tsx/i);
  });

  it('passes blue background when page.tsx uses bg-blue', () => {
    const before = `const preset = { pageBg: "bg-red-600" };`;
    const after = `const preset = { pageBg: "bg-blue-600", heroBg: "bg-blue-700" };
      return <main className="bg-blue-600">Hero</main>;`;
    const r = verifyEditApplied(
      'change background to blue',
      { 'src/app/page.tsx': before },
      { 'src/app/page.tsx': after }
    );
    expect(r.ok).toBe(true);
  });

  it('passes blue background when preset is blue but buttons still use bg-white', () => {
    const after = `const preset = {
      pageBg: "bg-blue-500",
      heroBg: "bg-blue-700",
      primaryButton: "bg-white text-blue-600"
    };`;
    const r = verifyEditApplied(
      'change background to blue',
      { 'src/app/page.tsx': 'const preset = { pageBg: "bg-green-500" };' },
      { 'src/app/page.tsx': after }
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

  it('passes section with image gallery in siteConfig', () => {
    const before = `export const siteConfig = { sections: [] };`;
    const after = `export const siteConfig = { sections: [{
      type: "generic",
      title: "Product documentation",
      body: "Great docs",
      items: [
        { title: "A", imageUrl: "/uploads/a.jpg" },
        { title: "B", imageUrl: "/uploads/b.jpg" }
      ]
    }] };`;

    const r = verifyEditApplied(
      'these are great documentations, make a section for it',
      { 'src/lib/siteConfig.ts': before },
      { 'src/lib/siteConfig.ts': after }
    );
    expect(r.ok).toBe(true);
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
