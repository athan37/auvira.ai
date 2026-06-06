import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  parseConfigFieldPath,
  readConfigFieldValue,
} from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { PresentationStyleField } from '@/lib/project-workspace/edit-context/inferPresentationStyleTarget';
import {
  assertSectionColorEditInvariants,
  type SectionPresentationField,
} from '@/lib/project-workspace/sectionPresentationEdit';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import type { DomainToolContext, DomainToolResult } from './types';
import type { VerificationCheck } from '@/lib/project-workspace/edit-context/types';

/**
 * Run hard source invariant checks for the current edit context.
 */
export async function verifySourceInvariantsTool(
  ctx: DomainToolContext
): Promise<DomainToolResult> {
  const errors: string[] = [];
  const checks = ctx.editContext.verificationContract.checks;

  for (const check of checks) {
    if (check.kind === 'section_background' && check.sectionIndex != null) {
      const siteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG));
      const page = await readWorkspaceRel(ctx.agentOptions, PAGE_TSX);
      const tailwind = await readWorkspaceRel(ctx.agentOptions, TAILWIND_CONFIG);

      if (!siteConfig || !page) {
        errors.push('Missing siteConfig or page for section background verification');
        continue;
      }

      const section = ctx.editContext.sections.find((s) => s.index === check.sectionIndex);
      const presentationField = coercePresentationField(check.field);
      const expectedClass =
        check.expectedValue ??
        parsePresentationFromContent(siteConfig, check.sectionIndex, presentationField);

      if (!expectedClass) {
        continue;
      }

      const invariantErrors = assertSectionColorEditInvariants({
        siteConfigContent: siteConfig,
        pageContent: page,
        tailwindContent: tailwind,
        sectionIndex: check.sectionIndex,
        rendererComponent: section?.rendererComponent ?? 'GenericSection',
        expectedBackgroundClass: expectedClass,
        presentationField,
        infraBaselineReady: ctx.editContext.infraBaselineReady,
        changedFiles: ctx.changedFiles,
      });

      errors.push(...invariantErrors);
    }

    if (check.kind === 'section_items' && check.sectionIndex != null) {
      const beforeSiteConfig = ctx.beforeFiles[SITE_CONFIG] ?? '';
      const afterSiteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG)) ??
        '';
      const sectionErrors = verifySectionItemsCheck(
        beforeSiteConfig,
        afterSiteConfig,
        check
      );
      errors.push(...sectionErrors);
    }

    if (check.kind === 'hero_field' && check.field) {
      const siteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG));
      if (!siteConfig) {
        errors.push('Missing siteConfig for hero verification');
        continue;
      }
      const field = check.field as 'headline' | 'subheadline' | 'tagline';
      const actual = readHeroFieldFromSource(siteConfig, field);
      if (check.expectedValue && String(actual ?? '').trim() !== check.expectedValue.trim()) {
        errors.push(`Hero ${field} does not match expected value`);
      }
    }

    if (check.kind === 'business_name') {
      const siteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG));
      if (!siteConfig) {
        errors.push('Missing siteConfig for business name verification');
        continue;
      }
      const parsed = parseSiteConfigSource(siteConfig);
      if (
        check.expectedValue &&
        String(parsed?.businessName ?? '').trim() !== check.expectedValue.trim()
      ) {
        errors.push('businessName does not match expected value');
      }
    }

    if (check.kind === 'contact_field' && check.field) {
      const siteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG));
      if (!siteConfig) {
        errors.push('Missing siteConfig for contact verification');
        continue;
      }
      const parsed = parseSiteConfigSource(siteConfig);
      const value = parsed?.contact?.[check.field as keyof typeof parsed.contact];
      if (check.expectedValue && String(value) !== check.expectedValue) {
        errors.push(`Contact ${check.field} does not match expected value`);
      }
    }

    if (check.kind === 'copy_field' && check.field && check.expectedValue) {
      const siteConfig =
        ctx.afterFiles[SITE_CONFIG] ??
        (await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG));
      if (!siteConfig) {
        errors.push('Missing siteConfig for copy_field verification');
        continue;
      }
      const parsedConfig = parseSiteConfigSource(siteConfig) as Record<string, unknown> | null;
      const fieldPath = check.field;
      const parsedPath = parseConfigFieldPath(fieldPath);
      if (parsedPath && parsedConfig) {
        const actual = readConfigFieldValue(parsedConfig, parsedPath);
        if (String(actual ?? '').trim() !== check.expectedValue.trim()) {
          errors.push(`Copy field ${fieldPath} does not match expected value`);
        }
        continue;
      }
      if (check.sectionIndex != null && (fieldPath === 'title' || fieldPath === 'body')) {
        const sections = parsedConfig?.sections;
        const section =
          Array.isArray(sections) && sections[check.sectionIndex]
            ? (sections[check.sectionIndex] as Record<string, unknown>)
            : undefined;
        const actual = section?.[fieldPath];
        if (String(actual ?? '').trim() !== check.expectedValue.trim()) {
          errors.push(`Section ${fieldPath} does not match expected value`);
        }
      }
    }

    if (check.kind === 'generic') {
      if (ctx.changedFiles.length === 0) {
        errors.push('No files changed');
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: errors,
    };
  }

  return {
    ok: true,
    changedFiles: [],
    summary: 'Source invariants passed.',
  };
}

function readHeroFieldFromSource(content: string, field: string): string | undefined {
  const key = field === 'subheadline' ? 'subheadline' : field === 'tagline' ? 'tagline' : 'headline';
  const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return match?.[1];
}

function coercePresentationField(field: unknown): SectionPresentationField {
  if (
    field === 'cardClass' ||
    field === 'titleClass' ||
    field === 'bodyClass' ||
    field === 'eyebrowClass'
  ) {
    return field;
  }
  return 'backgroundClass';
}

function parsePresentationFromContent(
  content: string,
  sectionIndex: number,
  field: PresentationStyleField = 'backgroundClass'
): string {
  const parsed = parseSiteConfigSource(content);
  const section = parsed?.sections?.[sectionIndex] as
    | {
        presentation?: Partial<
          Record<'backgroundClass' | 'cardClass' | 'titleClass' | 'bodyClass' | 'eyebrowClass', string>
        >;
      }
    | undefined;
  const value = section?.presentation?.[field];
  return value?.trim() ?? '';
}

function readSectionItems(content: string, sectionIndex: number): unknown[] {
  const parsed = parseSiteConfigSource(content);
  const section = parsed?.sections?.[sectionIndex] as { items?: unknown[] } | undefined;
  return Array.isArray(section?.items) ? section.items : [];
}

/** Verify generic sections[i].items[] structural mutations. */
export function verifySectionItemsCheck(
  beforeSiteConfig: string,
  afterSiteConfig: string,
  check: VerificationCheck
): string[] {
  const errors: string[] = [];
  const sectionIndex = check.sectionIndex;
  if (sectionIndex == null) return errors;

  const beforeItems = readSectionItems(beforeSiteConfig, sectionIndex);
  const afterItems = readSectionItems(afterSiteConfig, sectionIndex);

  if (check.expectedLengthDelta != null) {
    const expectedLength = beforeItems.length + check.expectedLengthDelta;
    if (afterItems.length !== expectedLength) {
      errors.push(
        `section ${sectionIndex} items length is ${afterItems.length}, expected ${expectedLength}`
      );
    }
  }

  if (check.operation === 'remove' && check.itemIndex != null) {
    const removed = beforeItems[check.itemIndex];
    if (removed && afterItems.includes(removed)) {
      errors.push(`section ${sectionIndex} item ${check.itemIndex} was not removed`);
    }
  }

  if (
    (check.operation === 'duplicate' || check.operation === 'add') &&
    check.expectedInsertIndex != null
  ) {
    const insertIndex = check.expectedInsertIndex;
    if (insertIndex >= afterItems.length) {
      errors.push(
        `section ${sectionIndex} expected new item at index ${insertIndex}, but items length is ${afterItems.length}`
      );
    }
  }

  if (check.expectedValue && check.field) {
    const candidateIndexes =
      check.expectedInsertIndex != null
        ? [check.expectedInsertIndex]
        : [afterItems.length - 1];
    const matched = candidateIndexes.some((idx) => {
      const item = afterItems[idx] as Record<string, unknown> | undefined;
      return String(item?.[check.field!] ?? '').trim() === check.expectedValue!.trim();
    });
    if (!matched) {
      errors.push(
        `section ${sectionIndex} item ${check.field} does not match expected "${check.expectedValue}"`
      );
    }
  }

  if (check.operation === 'update' && check.itemIndex != null && check.field && check.expectedValue) {
    const item = afterItems[check.itemIndex] as Record<string, unknown> | undefined;
    if (String(item?.[check.field] ?? '').trim() !== check.expectedValue.trim()) {
      errors.push(
        `section ${sectionIndex} item ${check.itemIndex} ${check.field} is "${String(item?.[check.field] ?? '')}", expected "${check.expectedValue}"`
      );
    }
  }

  const beforeParsed = parseSiteConfigSource(beforeSiteConfig);
  const afterParsed = parseSiteConfigSource(afterSiteConfig);
  const sectionCount = Math.max(
    beforeParsed?.sections?.length ?? 0,
    afterParsed?.sections?.length ?? 0
  );
  for (let i = 0; i < sectionCount; i++) {
    if (i === sectionIndex) continue;
    const beforeOther = JSON.stringify(readSectionItems(beforeSiteConfig, i));
    const afterOther = JSON.stringify(readSectionItems(afterSiteConfig, i));
    if (beforeOther !== afterOther) {
      errors.push(`section ${i} items changed unexpectedly during section ${sectionIndex} item edit`);
    }
  }

  return errors;
}
