import { describe, expect, it } from 'vitest';
import { repairContactFieldClassInPage } from '@/lib/preview/repairContactFieldClass';

describe('repairContactFieldClassInPage', () => {
  it('replaces hardcoded contact field classes and injects resolver', () => {
    const before = `
function resolveSectionCardClass() {}
function resolveSectionEyebrowClass() {}
<div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200" data-site-element-kind="contact_field" />
`;
    const { content, repaired } = repairContactFieldClassInPage(before);
    expect(repaired).toBe(true);
    expect(content).toContain('resolveContactFieldClass(section, preset)');
    expect(content).toContain('function resolveContactFieldClass');
    expect(content).not.toContain('bg-white/5 p-4 text-sm text-slate-200"');
  });
});
