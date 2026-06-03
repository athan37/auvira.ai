import { describe, expect, it } from 'vitest';
import { repairContactSectionSubtitleInPage } from '@/lib/preview/repairContactSectionSubtitle';

const LEGACY_CONTACT_CARD = `
function ContactSection({ section, sectionIndex }) {
  return (
    <section id="contact">
      <div className={"rounded-[2rem] border p-8 " + resolveSectionCardClass(section, preset)}>
        <h3 className="text-xl font-bold">Contact Information</h3>
      </div>
    </section>
  );
}
`;

describe('repairContactSectionSubtitleInPage', () => {
  it('replaces hardcoded Contact Information h3 with section.subtitle binding', () => {
    const { content, repaired } = repairContactSectionSubtitleInPage(LEGACY_CONTACT_CARD);
    expect(repaired).toBe(true);
    expect(content).toContain("{section.subtitle || 'Contact Information'}");
    expect(content).not.toMatch(/>\s*Contact Information\s*<\/h3>/);
  });

  it('is idempotent when subtitle binding already present', () => {
    const wired = LEGACY_CONTACT_CARD.replace(
      '<h3 className="text-xl font-bold">Contact Information</h3>',
      "<h3 className=\"text-xl font-bold\">{section.subtitle || 'Contact Information'}</h3>"
    );
    const { content, repaired } = repairContactSectionSubtitleInPage(wired);
    expect(repaired).toBe(false);
    expect(content).toBe(wired);
  });
});
