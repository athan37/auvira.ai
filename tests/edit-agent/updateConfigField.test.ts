import { describe, expect, it } from 'vitest';
import { parseConfigFieldPath, readConfigFieldValue } from '@/lib/project-workspace/edit-context/configFieldPaths';
import { updateConfigFieldInSource } from '@/lib/project-workspace/siteConfigMutations';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';

const siteConfig = `export const siteConfig = {
  businessName: "Acme",
  sections: [
    {
      type: "services",
      title: "Old Title",
      items: [{ title: "Item A", description: "Desc A" }]
    }
  ]
};`;

describe('updateConfigFieldInSource', () => {
  it('mutates allowlisted section title path', () => {
    const updated = updateConfigFieldInSource(
      siteConfig,
      'sections[0].title',
      'New Title'
    );
    expect(updated).toBeTruthy();
    const parsed = parseSiteConfigSource(updated!);
    expect(parsed?.sections?.[0]?.title).toBe('New Title');
  });

  it('mutates allowlisted item description path', () => {
    const updated = updateConfigFieldInSource(
      siteConfig,
      'sections[0].items[0].description',
      'Updated description'
    );
    expect(updated).toBeTruthy();
    const parsed = parseSiteConfigSource(updated!) as unknown as Record<string, unknown>;
    const sections = parsed.sections as Array<Record<string, unknown>>;
    const items = sections[0]?.items as Array<Record<string, unknown>>;
    expect(items[0]?.description).toBe('Updated description');
  });

  it('rejects non-allowlisted paths', () => {
    const updated = updateConfigFieldInSource(siteConfig, 'sections[0].unknown', 'x');
    expect(updated).toBeNull();
  });

  it('returns null when section field already equals requested value', () => {
    const withSubtitle = updateConfigFieldInSource(
      siteConfig,
      'sections[0].title',
      'Old Title'
    );
    expect(withSubtitle).toBeNull();
  });
});

describe('configFieldPaths', () => {
  it('reads values from parsed config', () => {
    const parsed = parseConfigFieldPath('sections[0].title');
    expect(parsed).toBeTruthy();
    const config = parseSiteConfigSource(siteConfig) as unknown as Record<string, unknown>;
    expect(readConfigFieldValue(config, parsed!)).toBe('Old Title');
  });
});
