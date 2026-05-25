import { describe, it, expect } from 'vitest';
import {
  patchDocumentationSectionForImages,
  patchGenericSectionForImages,
} from '../../src/lib/project-workspace/website-edit-agent/patchGenericSectionImages';

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

  it('fixes DocumentationSection to use imageUrl or description', () => {
    const src = `
function DocumentationSection({ section }) {
  return <img src={item.description} alt={item.title} />;
}
`;
    const { content, patched } = patchDocumentationSectionForImages(src);
    expect(patched).toBe(true);
    expect(content).toContain('item.imageUrl || item.description');
  });

  it('patches custom 2-column GenericSection layout', () => {
    const custom = `
function GenericSection({ section }) {
  return (
    <section>
      <div className="grid">
        {section.items && <ul>{section.items.map(() => null)}</ul>}
      </div>
      {section.imageUrl && (
        <div><img src={section.imageUrl} alt="" /></div>
      )}
        </div>
      </div>
    </section>
  );
}
`;
    const { content, patched } = patchGenericSectionForImages(custom);
    expect(patched).toBe(true);
    expect(content).toContain('filter((item) => (item as { imageUrl?: string }).imageUrl)');
  });

  it('skips when GenericSection already renders item imageUrl grid', () => {
    const { content, patched } = patchGenericSectionForImages(MINIMAL_GENERIC);
    const second = patchGenericSectionForImages(content);
    expect(second.patched).toBe(false);
  });
});
