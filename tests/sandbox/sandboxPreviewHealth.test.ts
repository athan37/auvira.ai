import { describe, expect, it } from 'vitest';
import { checkTsxSyntax } from '../../src/lib/project-workspace/validateTsxSyntax';
import {
  extractPresetJsonFromPage,
  rebuildPageFromTemplate,
} from '../../src/lib/sandbox/sandboxPreviewHealth';

describe('sandboxPreviewHealth', () => {
  it('detects broken JSX before Footer (same class of error as production)', () => {
    const broken = `function GallerySection() {
  return (
    <section>
      <div className={"x " + preset.card}
    </section>
  );
}
function Footer() {
  return (
    <footer className={"px-4 py-12 " + preset.footerBg + " text-white"}>
      <p>Hi</p>
    </footer>
  );
}`;
    const errors = checkTsxSyntax(broken, 'src/app/page.tsx');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rebuilds valid page from template using extracted preset', () => {
    const preset = '{"name":"Test","pageBg":"bg-white","surfaceBg":"bg-white","mutedBg":"bg-gray-100","navBg":"bg-white","navBorder":"border-gray-200","navText":"text-black","heroBg":"bg-blue-900","heroOverlay":"","heroText":"text-white","heroMutedText":"text-blue-200","heroEyebrow":"text-blue-300","primaryButton":"bg-blue-600 text-white","secondaryButton":"border text-white","darkButton":"bg-black text-white","card":"bg-white border p-4","cardHover":"hover:shadow","cardAccent":"border-t-blue-600","iconBadge":"bg-blue-600 text-white w-12 h-12","sectionEyebrow":"text-blue-600","sectionTitle":"text-black","sectionBody":"text-gray-600","contactBg":"bg-blue-900","footerBg":"bg-blue-800","footerAccent":"text-blue-200","fontHeading":"font-serif","fontBody":"font-sans","sectionSpacing":"py-20"}';
    const page = `const preset = ${preset};\nexport default function Home() { return null; }`;
    const extracted = extractPresetJsonFromPage(page);
    expect(extracted).toBe(preset);
    const rebuilt = rebuildPageFromTemplate(extracted!);
    expect(checkTsxSyntax(rebuilt, 'src/app/page.tsx')).toEqual([]);
    expect(rebuilt).toContain('GallerySection');
    expect(rebuilt).toContain('GenericSection');
  });
});
