import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  parseConfigFieldPath,
  readConfigFieldValue,
} from '@/lib/project-workspace/edit-context/configFieldPaths';
import { assertSectionColorEditInvariants } from '@/lib/project-workspace/sectionPresentationEdit';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import type { DomainToolContext, DomainToolResult } from './types';

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
      const presentationField =
        check.field === 'cardClass' ? 'cardClass' : 'backgroundClass';
      const expectedClass =
        check.expectedValue ?? parseBackgroundFromContent(siteConfig, check.sectionIndex, presentationField);

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

function parseBackgroundFromContent(
  content: string,
  sectionIndex: number,
  field: 'backgroundClass' | 'cardClass' = 'backgroundClass'
): string {
  const parsed = parseSiteConfigSource(content);
  const section = parsed?.sections?.[sectionIndex] as
    | { presentation?: { backgroundClass?: string; cardClass?: string } }
    | undefined;
  const value = section?.presentation?.[field];
  return value?.trim() ?? '';
}
