import { describe, expect, it } from 'vitest';
import {
  addSectionItemToSource,
  duplicateSectionItemInSource,
  removeSectionItemFromSource,
  updateSectionItemInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';

const SAMPLE = `export const siteConfig = {
  sections: [
    {
      type: 'generic',
      title: 'Stay Connected',
      items: [
        { title: 'Card one', description: 'First card' },
        { title: 'Card two', description: 'Second card' },
      ],
    },
    {
      type: 'services',
      title: 'Services',
      items: [{ title: 'Existing service', description: 'Keep me' }],
    },
  ],
};`;

describe('siteConfigMutations section item helpers', () => {
  it('adds a titled item to the end of a section items list', () => {
    const updated = addSectionItemToSource(SAMPLE, 0, { title: 'hello' });
    expect(updated).toContain('"title": "hello"');
    const parsed = parseSiteConfigSource(updated!);
    const items = (parsed?.sections?.[0] as { items?: unknown[] }).items ?? [];
    expect(items).toHaveLength(3);
  });

  it('inserts after a source item when insertAfterIndex is set', () => {
    const updated = addSectionItemToSource(
      SAMPLE,
      0,
      { title: 'Inserted', description: 'Second card' },
      { insertAfterIndex: 1 }
    );
    const parsed = parseSiteConfigSource(updated!);
    const items = (parsed?.sections?.[0] as { items?: Array<{ title?: string }> }).items ?? [];
    expect(items).toHaveLength(3);
    expect(items[2]?.title).toBe('Inserted');
  });

  it('duplicates an item after the pinned index with optional overrides', () => {
    const updated = duplicateSectionItemInSource(SAMPLE, 0, 1, { title: 'Clone title' });
    const parsed = parseSiteConfigSource(updated!);
    const items = (parsed?.sections?.[0] as { items?: Array<{ title?: string; description?: string }> }).items ?? [];
    expect(items).toHaveLength(3);
    expect(items[2]?.title).toBe('Clone title');
    expect(items[2]?.description).toBe('Second card');
  });

  it('removes an item by index', () => {
    const updated = removeSectionItemFromSource(SAMPLE, 0, 1);
    const parsed = parseSiteConfigSource(updated!);
    const items = (parsed?.sections?.[0] as { items?: Array<{ title?: string }> }).items ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Card one');
  });

  it('updates allowlisted item fields', () => {
    const updated = updateSectionItemInSource(SAMPLE, 0, 0, { title: 'Updated title' });
    expect(updated).toContain('"Updated title"');
  });

  it('does not mutate unrelated sections', () => {
    const updated = addSectionItemToSource(SAMPLE, 0, { title: 'hello' });
    expect(updated).toContain('"Existing service"');
    const parsed = parseSiteConfigSource(updated!);
    const otherItems = (parsed?.sections?.[1] as { items?: unknown[] }).items ?? [];
    expect(otherItems).toHaveLength(1);
  });
});
