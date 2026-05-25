import { describe, it, expect } from 'vitest';
import { checkTsxSyntax, isValidTsxSource } from '../../src/lib/project-workspace/validateTsxSyntax';
import { dedupePageComponentFunctions, repairPageTsxStructure } from '../../src/lib/project-workspace/repairPageTsxStructure';

describe('validateTsxSyntax', () => {
  it('accepts valid Footer JSX', () => {
    const src = `function Footer() {
  return (<footer className="bg-red-600"><p>Hi</p></footer>);
}`;
    expect(isValidTsxSource(src, 'page.tsx')).toBe(true);
  });

  it('rejects unclosed JSX', () => {
    const src = `function Footer() {
  return (<footer><div></footer);
}`;
    expect(isValidTsxSource(src, 'page.tsx')).toBe(false);
    expect(checkTsxSyntax(src, 'page.tsx').length).toBeGreaterThan(0);
  });
});

describe('repairPageTsxStructure', () => {
  it('removes duplicate GallerySection', () => {
    const src = `function GallerySection() { return <section>A</section>; }
function GallerySection() { return <section>B</section>; }`;
    const { content, removed } = dedupePageComponentFunctions(src, 'GallerySection');
    expect(removed).toBe(1);
    expect(content.match(/function GallerySection/g)?.length).toBe(1);
    expect(content).toContain('A');
    expect(content).not.toContain('B');
  });

  it('splits smashed switch cases', () => {
    const src = `switch (x) {
    case 'contact': return <C />;    case 'gallery': return <G />;
    default: return null;
  }`;
    const { content, repaired } = repairPageTsxStructure(src);
    expect(repaired).toBe(true);
    expect(content).toMatch(/case 'contact'[\s\S]*\n\s*case 'gallery'/);
  });
});
