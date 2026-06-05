import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import {
  contactExtraLineFieldPath,
  parseConfigFieldPath,
  readConfigFieldValue,
} from '@/lib/project-workspace/edit-context/configFieldPaths';
import {
  appendContactExtraLineInSource,
  updateConfigFieldInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const siteConfig = `export const siteConfig = {
  businessName: "Acme",
  contact: {
    phone: "hello 1234",
    email: "what is going on@edu.com",
    extraLines: ["support@acme.com"]
  },
  sections: []
};`;

describe('contact.extraLines mutations', () => {
  it('appends a new contact card row', () => {
    const updated = appendContactExtraLineInSource(siteConfig, 'billing@acme.com');
    expect(updated).toBeTruthy();
    const parsed = parseSiteConfigSource(updated!) as Record<string, unknown>;
    const contact = parsed.contact as { extraLines?: string[] };
    expect(contact.extraLines).toEqual(['support@acme.com', 'billing@acme.com']);
  });

  it('updates an existing extra line by index', () => {
    const updated = updateConfigFieldInSource(
      siteConfig,
      contactExtraLineFieldPath(0),
      'help@acme.com'
    );
    expect(updated).toBeTruthy();
    const parsed = parseSiteConfigSource(updated!) as Record<string, unknown>;
    const contact = parsed.contact as { extraLines?: string[] };
    expect(contact.extraLines?.[0]).toBe('help@acme.com');
  });

  it('parses and reads contact.extraLines paths', () => {
    const parsedPath = parseConfigFieldPath('contact.extraLines[0]');
    expect(parsedPath?.field).toBe('extraLines');
    expect(parsedPath?.contactExtraLineIndex).toBe(0);
    const config = parseSiteConfigSource(siteConfig) as unknown as Record<string, unknown>;
    expect(readConfigFieldValue(config, parsedPath!)).toBe('support@acme.com');
  });
});

describe('buildDeterministicPlan add contact line', () => {
  it('plans add_contact_extra_line for hero card requests', () => {
    const context = {
      effectiveMessage: 'Add another contact line with "billing@acme.com"',
      ownerMessage: 'Add another contact line with "billing@acme.com"',
      conversationHistory: [],
      siteModel: { siteConfigContent: siteConfig },
      target: {},
    } as EditContext;

    const plan = buildDeterministicPlan(context);
    expect(plan?.steps?.[0]?.skill).toBe('add_contact_extra_line');
    expect(plan?.steps?.[0]?.params).toEqual({ value: 'billing@acme.com' });
  });
});
