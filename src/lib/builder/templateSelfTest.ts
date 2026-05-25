/**
 * Self-test for template generation.
 * Generates files from a mock siteSpec and asserts the data-driven approach works.
 * Run with: npx tsx src/lib/builder/templateSelfTest.ts
 */
import { generateWebsiteFiles } from './generateWebsiteFiles';
import { validateGeneratedFiles } from './validateGeneratedFiles';
import type { SiteSpec } from '../agent/schemas';

const mockSiteSpec: SiteSpec = {
  siteTitle: 'Test Plumbing Co',
  tagline: 'Professional Plumbing Services Available 24/7',
  primaryCTA: 'Call Today',
  secondaryCTA: 'Get Quote',
  sections: [
    {
      type: 'hero',
      title: 'Hero',
      items: ['Emergency Service', 'Licensed & Insured', 'Fast Response'],
      body: 'Your trusted local plumbing experts',
    },
    {
      type: 'services',
      title: 'Our Services',
      items: [
        'Drain Cleaning',
        'Water Heater Repair',
        'Leak Detection',
        'Pipe Replacement',
        'Sewer Line Service',
        'Gas Line Installation',
      ],
      body: 'Quality Workmanship - Professional plumbing services for residential and commercial properties.',
    },
    {
      type: 'about',
      title: 'About Us',
      items: [
        '25 Years Experience',
        '1000+ Projects',
        'Free Estimates',
      ],
      body: 'About Our Company - We are the best plumbers in town.',
    },
    {
      type: 'testimonials',
      title: 'What Our Customers Say',
      items: [
        'John D. - Excellent service!',
        'Sarah M. - Very professional.',
        'Mike R. - Fast and affordable.',
      ],
      body: 'Join thousands of satisfied customers.',
    },
    {
      type: 'contact',
      title: 'Connect With Us',
      items: ['Phone: (555) 123-4567', 'Email: info@testplumbing.com'],
      body: 'Get in touch today for all your plumbing needs!',
    },
  ],
  designDirection: {
    tone: 'professional',
    layout: 'split-hero',
    colors: ['#0284C7', '#0C4A6E'],
  },
};

function runTemplateSelfTest(): void {
  console.log('=== Template Self-Test ===\n');

  // 1. Generate files
  console.log('1. Generating website files...');
  let result;
  try {
    result = generateWebsiteFiles(mockSiteSpec, 'test-template-self-check');
    console.log(`   Generated ${result.files.length} files`);
  } catch (err) {
    console.error('   FAIL: generateWebsiteFiles threw:', err);
    process.exit(1);
  }

  // 2. Find page.tsx
  const pageFile = result.files.find(f => f.filePath === 'src/app/page.tsx');
  if (!pageFile) {
    console.error('   FAIL: page.tsx not found in generated files');
    process.exit(1);
  }
  console.log('   page.tsx found');
  console.log(`   page.tsx length: ${pageFile.content.length} chars`);

  // 3. Check for forbidden HTML injection patterns
  console.log('\n2. Checking no HTML injection patterns...');
  const forbiddenPatterns = [
    { pattern: 'dangerouslySetInnerHTML', name: 'dangerouslySetInnerHTML' },
    { pattern: 'contentSectionsHtml', name: 'contentSectionsHtml' },
    { pattern: 'contactSectionHtml', name: 'contactSectionHtml' },
    { pattern: '__CONTENT_SECTIONS_HTML__', name: '__CONTENT_SECTIONS_HTML__' },
    { pattern: '__CONTACT_SECTION_HTML__', name: '__CONTACT_SECTION_HTML__' },
    { pattern: 'htmlSection', name: 'htmlSection' },
  ];

  let foundForbidden = false;
  for (const { pattern, name } of forbiddenPatterns) {
    if (pageFile.content.includes(pattern)) {
      console.error(`   FAIL: Found forbidden pattern: "${name}"`);
      foundForbidden = true;
    }
  }
  if (!foundForbidden) {
    console.log('   PASS: No HTML injection patterns found');
  } else {
    process.exit(1);
  }

  // 4. Check for unresolved placeholder tokens
  console.log('\n3. Checking for unresolved placeholders...');
  const badTokens = [
    '__THEME_PRESET_JSON__',
    '__TEMPLATE_CATEGORY__',
    '__TEMPLATE_VARIANT__',
    '\\${',
    'escapedSiteSpec',
  ];

  let foundBadToken = false;
  for (const token of badTokens) {
    if (pageFile.content.includes(token)) {
      console.error(`   FAIL: Found unresolved token: "${token}"`);
      foundBadToken = true;
    }
  }
  if (!foundBadToken) {
    console.log('   PASS: No unresolved placeholder tokens');
  } else {
    process.exit(1);
  }

  // 5. Check for markdown heading artifacts in page.tsx
  console.log('\n4. Checking for markdown heading artifacts...');
  if (/^#{1,3}\s+\S/m.test(pageFile.content)) {
    console.error('   FAIL: Markdown heading artifact found in page.tsx');
    process.exit(1);
  }
  console.log('   PASS: No markdown heading artifacts');

  // 6. Check required data-driven structure
  console.log('\n5. Checking required data-driven structure...');
  const requiredPatterns = [
    { pattern: 'export default function Home', name: 'export default function Home' },
    { pattern: 'function SectionRenderer', name: 'SectionRenderer function' },
    { pattern: 'siteConfig.sections.map', name: 'siteConfig.sections.map' },
    { pattern: 'import { siteConfig }', name: 'siteConfig import' },
  ];

  for (const { pattern, name } of requiredPatterns) {
    if (!pageFile.content.includes(pattern)) {
      console.error(`   FAIL: Missing ${name}`);
      process.exit(1);
    }
  }
  console.log('   PASS: All required patterns found');

  // 7. Check siteConfig.ts structure
  const siteConfigFile = result.files.find(f => f.filePath === 'src/lib/siteConfig.ts');
  if (!siteConfigFile) {
    console.error('   FAIL: siteConfig.ts not found');
    process.exit(1);
  }
  console.log('\n6. Checking siteConfig.ts structure...');
  if (!siteConfigFile.content.includes('export const siteConfig')) {
    console.error('   FAIL: Missing export const siteConfig');
    process.exit(1);
  }
  if (!siteConfigFile.content.includes('export type SiteConfig')) {
    console.error('   FAIL: Missing export type SiteConfig');
    process.exit(1);
  }
  if (!siteConfigFile.content.includes('export type SiteSection')) {
    console.error('   FAIL: Missing export type SiteSection');
    process.exit(1);
  }
  console.log('   PASS: siteConfig.ts has proper typed exports');

  // 8. Run validateGeneratedFiles
  console.log('\n7. Running validateGeneratedFiles...');
  const validationErrors = validateGeneratedFiles(mockSiteSpec, 'test-template-self-check');
  if (validationErrors.length > 0) {
    console.error('   FAIL: validateGeneratedFiles returned errors:');
    for (const err of validationErrors) {
      console.error(`     - ${err.file}: ${err.error}`);
    }
    process.exit(1);
  }
  console.log('   PASS: validateGeneratedFiles passed');

  // 9. Verify section renderers exist
  console.log('\n8. Checking section renderers...');
  const sectionRenderers = [
    'ServicesSection',
    'AboutSection',
    'TestimonialsSection',
    'ContactSection',
  ];
  for (const name of sectionRenderers) {
    if (!pageFile.content.includes(`function ${name}`)) {
      console.error(`   FAIL: Missing function ${name}`);
      process.exit(1);
    }
  }
  console.log('   PASS: All section renderers found');

  console.log('\n=== ALL TESTS PASSED ===\n');
}

runTemplateSelfTest();