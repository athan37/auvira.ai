import { describe, it, expect } from 'vitest';
import { patchGenericSectionForImages } from '../../src/lib/project-workspace/website-edit-agent/patchGenericSectionImages';

const MINIMAL_GENERIC = `
function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section>
      {section.body && <p>{section.body}</p>}
      {section.items && section.items.length > 0 && (
        <div className="grid">text</div>
      )}
    </section>
  );
}
`;

describe('patchGenericSectionForImages', () => {
  it('injects image grid when GenericSection lacks imageUrl', () => {
    const { content, patched } = patchGenericSectionForImages(MINIMAL_GENERIC);
    expect(patched).toBe(true);
    expect(content).toContain('imageUrl');
    expect(content).toContain('<img');
  });

  it('skips when imageUrl already present', () => {
    const already = MINIMAL_GENERIC.replace(
      'function GenericSection',
      'function GenericSection /* item.imageUrl */'
    );
    const { patched } = patchGenericSectionForImages(already);
    expect(patched).toBe(false);
  });
});
