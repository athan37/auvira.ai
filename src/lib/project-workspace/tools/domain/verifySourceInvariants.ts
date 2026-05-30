import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { assertSectionColorEditInvariants } from '@/lib/project-workspace/sectionPresentationEdit';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
} from '@/lib/project-workspace/website-edit-agent/strategyContext';
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
      const expectedClass =
        check.expectedValue ?? parseBackgroundFromContent(siteConfig, check.sectionIndex);

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
        infraBaselineReady: ctx.editContext.infraBaselineReady,
        changedFiles: ctx.changedFiles,
      });

      errors.push(...invariantErrors);
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

function parseBackgroundFromContent(content: string, sectionIndex: number): string {
  const parsed = parseSiteConfigSource(content);
  const section = parsed?.sections?.[sectionIndex] as
    | { presentation?: { backgroundClass?: string } }
    | undefined;
  return section?.presentation?.backgroundClass?.trim() ?? '';
}
