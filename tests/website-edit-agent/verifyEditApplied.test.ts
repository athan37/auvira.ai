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

  it('passes green background when preset uses gradient from-green (not only bg-green)', () => {
    const before = `const preset = {"pageBg":"bg-gradient-to-br from-red-800 via-red-700 to-red-900","heroBg":"bg-red-700"};`;
    const after = `const preset = {"pageBg":"bg-gradient-to-br from-green-800 via-green-700 to-green-900","heroBg":"bg-gradient-to-br from-green-900 to-green-950"};`;
    const r = verifyEditApplied(
      'change background color of the site to green',
      { 'src/app/page.tsx': before },
      { 'src/app/page.tsx': after }
    );
    expect(r.ok).toBe(true);
  });

  it('passes hero headline text-black without requiring bg-black in preset', () => {
    const before = `const preset = { heroText: "text-white", heroBg: "bg-blue-900" };`;
    const after = `const preset = { heroText: "text-black", heroBg: "bg-blue-900" };`;
    const r = verifyEditApplied(
      'Change the hero headline to black',
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

  it('passes section when siteConfig uses quoted JSON keys', () => {
    const before = `export const siteConfig = { "sections": [] };`;
    const after = `export const siteConfig = { "sections": [{
      "type": "gallery",
      "title": "Gallery",
      "items": [{ "title": "A", "imageUrl": "/uploads/a.jpg" }]
    }] };`;
    const r = verifyEditApplied(
      'add a gallery section with images',
      { 'src/lib/siteConfig.ts': before },
      { 'src/lib/siteConfig.ts': after }
    );
    expect(r.ok).toBe(true);
  });

  it('passes section request when siteConfig sections grow', () => {
    const before = `export const siteConfig = { sections: [{ type: "about", title: "About", items: [] }] };`;
    const after = `export const siteConfig = { sections: [
      { type: "about", title: "About", items: [] },
      { type: "faq", title: "FAQ", items: [
        { title: "What services do you offer?", description: "We offer HVAC and plumbing." },
        { title: "Do you offer same-day service?", description: "Yes, when available." },
        { title: "How do I book?", description: "Call or use our online form." }
      ]}
    ] };`;

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

  it('fails when siteConfig does not parse after edit', () => {
    const before = `export const siteConfig = { sections: [{ type: "testimonials", title: "Reviews", items: [] }] };`;
    const after = `export const siteConfig = { sections: [{ title: "bad " unclosed" }] };`;

    const r = verifyEditApplied(
      'add testimonials',
      { 'src/lib/siteConfig.ts': before },
      { 'src/lib/siteConfig.ts': after }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/parse failed/i);
  });

  it('fails scoped card color when only siteConfig changed', () => {
    const before = `export const siteConfig = { sections: [{ type: "testimonials", items: [] }] };`;
    const after = `export const siteConfig = { sections: [{ type: "testimonials", items: [{ title: "x", imageUrl: "#ff0000" }] }] };`;
    const page = `const preset = { card: "border-slate-200" }; export default function Home() { return null; }`;

    const r = verifyEditApplied(
      'change the card below to red in the section what our customers say to red',
      { 'src/lib/siteConfig.ts': before, 'src/app/page.tsx': page },
      { 'src/lib/siteConfig.ts': after, 'src/app/page.tsx': page }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/page\.tsx/i);
  });
});
