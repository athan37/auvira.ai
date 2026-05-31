import { describe, expect, it } from 'vitest';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';
import type { GeneratedFile } from '@/lib/builder/types';

const sampleSpec: SiteSpec = {
  siteTitle: 'Build Gate Test Co',
  tagline: 'Quality services',
  primaryCTA: 'Call now',
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
  secondaryCTA: 'Learn more',
  sections: [
    { type: 'hero', title: 'Welcome', body: 'Hero copy', items: [] },
    { type: 'services', title: 'Services', body: 'What we do', items: ['Repair', 'Install'] },
    {
      type: 'testimonials',
      title: 'Reviews',
      body: 'Happy customers',
      items: ['Great work from the team'],
    },
    { type: 'contact', title: 'Contact', body: 'Reach us', items: ['Phone: 512-555-0100'] },
  ],
};

function fileContent(files: GeneratedFile[], path: string): string {
  return files.find((f) => f.filePath === path)?.content ?? '';
}

describe('validateGeneratedFiles on actual GeneratedFile[]', () => {
  it('passes for files from generateWebsiteFiles', () => {
    const generated = generateWebsiteFiles(
      sampleSpec,
      'build-gate-test',
      getDefaultDesignBrief('general-service'),
      { category: 'general-service', variant: 'modern-clean', reason: 'test' }
    );
    const errors = validateGeneratedFiles(generated.files);
    expect(errors).toEqual([]);
  });

  it('fails when tailwind config is missing safelist and src scan', () => {
    const generated = generateWebsiteFiles(
      sampleSpec,
      'build-gate-test-broken',
      getDefaultDesignBrief('general-service')
    );
    const broken = generated.files.map((file) => {
      if (file.filePath !== 'tailwind.config.js') return file;
      return {
        ...file,
        content: `module.exports = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
}`,
      };
    });
    const errors = validateGeneratedFiles(broken);
    expect(errors.some((e) => e.file === 'tailwind.config.js')).toBe(true);
  });

  it('fails when tailwind config object literal is invalid JavaScript', () => {
    const generated = generateWebsiteFiles(sampleSpec, 'invalid-tailwind', getDefaultDesignBrief('general-service'));
    const broken = generated.files.map((file) => {
      if (file.filePath !== 'tailwind.config.js') return file;
      return {
        ...file,
        content: file.content.replace('],\n  safelist:', ']\n  safelist:'),
      };
    });
    const errors = validateGeneratedFiles(broken);
    expect(errors.some((e) => e.file === 'tailwind.config.js' && /Invalid JavaScript/.test(e.error))).toBe(true);
  });

  it('flags unescaped testimonial quotes in page.tsx', () => {
    const generated = generateWebsiteFiles(sampleSpec, 'bad-quotes', getDefaultDesignBrief('general-service'));
    const broken = generated.files.map((file) => {
      if (file.filePath !== 'src/app/page.tsx') return file;
      return {
        ...file,
        content: file.content.replace('&ldquo;', '"').replace('&rdquo;', '"'),
      };
    });
    const errors = validateGeneratedFiles(broken);
    expect(errors.some((e) => e.file === 'src/app/page.tsx' && /unescaped JSX quote/i.test(e.error))).toBe(true);
  });
});
