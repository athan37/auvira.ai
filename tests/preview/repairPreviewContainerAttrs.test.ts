import { describe, expect, it } from 'vitest';
import { repairPreviewContainerAttrsInPage } from '@/lib/preview/repairPreviewContainerAttrs';

describe('repairPreviewContainerAttrsInPage', () => {
  it('injects SITE_CONTAINER_ATTRS helper when usages exist without definition', () => {
    const page = `function SITE_SECTION_DATA_ATTRS() {
  return {};
}

function ContactSection() {
  return <div {...SITE_CONTAINER_ATTRS({ kind: "inner_card", label: "Contact card" })} />;
}
`;
    const { content, repaired } = repairPreviewContainerAttrsInPage(page);
    expect(repaired).toBe(true);
    expect(content).toContain('function SITE_CONTAINER_ATTRS');
    expect(content).toContain('data-site-container-kind');
  });
});
