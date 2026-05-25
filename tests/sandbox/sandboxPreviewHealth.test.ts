import { describe, it, expect } from 'vitest';
import { checkTsxSyntax } from '../../src/lib/project-workspace/validateTsxSyntax';

describe('assertSandboxPageSyntax (tsx check)', () => {
  it('detects broken JSX before Footer (same class of error as production)', () => {
    const broken = `function GallerySection() {
  return (
    <section>
      <div className={"x " + preset.card}
    </section>
  );
}
// Footer component
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
});
