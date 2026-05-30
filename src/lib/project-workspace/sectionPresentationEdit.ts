/**
 * Authoritative pipeline for section background color edits.
 * All section_style / update_section_style paths should delegate here.
 */

import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { tailwindConfigCoversBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';
import { appendSiteConfigPresentationSyncExport, hasInvalidNextJsPageExports, sanitizeSourceForPublish } from '@/lib/site-manager/siteConfigAgentMarkers';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  updateSectionBackgroundColorInSource,
  updateSectionPresentationInSource,
} from './website-edit-agent-v2/siteConfigMutations';
import {
  ensureLegacyPageReadsPresentation,
  ensureTailwindPresentationSupport,
  rendererComponentForSectionType,
  repairSectionPresentationWiringInWorkspace,
  upgradeSectionComponentToPresentationResolver,
  sectionComponentUsesPresetBackground,
} from './website-edit-agent/legacySectionPresentation';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from './website-edit-agent/strategyContext';
import {
  sectionPresentationBackgroundClass,
  sectionRendererUsesPresentationResolver,
} from './previewReflectsSiteConfig';
import type { WebsiteEditAgentOptions } from './website-edit-agent/types';

/** Target section for a background presentation edit. */
export interface SectionBackgroundTarget {
  sectionIndex: number;
  sectionType: string;
  title?: string;
  rendererComponent?: string;
}

/** Infra baseline flags controlling legacy repair breadth. */
export interface ProjectInfraStatus {
  infraBaselineReady: boolean;
}

export interface SectionPresentationWorkspace {
  workspacePath: string;
  gateway?: WebsiteEditAgentOptions['gateway'];
  ownerMessage?: string;
}

export interface ApplySectionBackgroundEditInput {
  workspace: SectionPresentationWorkspace;
  sectionTarget: SectionBackgroundTarget;
  /** Explicit Tailwind class (e.g. bg-red-600). Takes precedence over colorName. */
  backgroundClass?: string;
  /** Color word from owner message when backgroundClass is omitted. */
  colorName?: string;
  projectInfraStatus: ProjectInfraStatus;
}

export interface ApplySectionBackgroundEditResult {
  ok: boolean;
  backgroundClass: string;
  sectionIndex: number;
  sectionType: string;
  sectionTitle: string;
  rendererComponent: string;
  changedFiles: string[];
  summary: string;
  invariantErrors: string[];
}

export interface AssertSectionColorEditInvariantsInput {
  siteConfigContent: string;
  pageContent: string;
  tailwindContent: string | null;
  sectionIndex: number;
  rendererComponent: string;
  expectedBackgroundClass: string;
  infraBaselineReady: boolean;
  changedFiles: string[];
  /** tailwind.config.js content before any pipeline tailwind mutation (infra-ready guard). */
  tailwindContentBefore?: string | null;
}

function workspaceOptions(
  workspace: SectionPresentationWorkspace
): WebsiteEditAgentOptions {
  return {
    workspacePath: workspace.workspacePath,
    gateway: workspace.gateway,
    ownerMessage: workspace.ownerMessage ?? '',
    projectId: 'section-presentation-edit',
    mode: 'gitlab',
  };
}

function readWriteAdapter(workspace: SectionPresentationWorkspace) {
  const options = workspaceOptions(workspace);
  return {
    read: (rel: string) => readWorkspaceRel(options, rel),
    write: async (rel: string, content: string) => {
      await writeWorkspaceRel(options, rel, content);
    },
  };
}

function buildSummary(sectionTitle: string, backgroundClass: string): string {
  return `Changed background of "${sectionTitle}" to ${backgroundClass}.`;
}

/** Hard source invariants after a section background edit. */
export function assertSectionColorEditInvariants(
  input: AssertSectionColorEditInvariantsInput
): string[] {
  const errors: string[] = [];
  const {
    siteConfigContent,
    pageContent,
    tailwindContent,
    sectionIndex,
    rendererComponent,
    expectedBackgroundClass,
    infraBaselineReady,
    changedFiles,
  } = input;

  const actualClass = sectionPresentationBackgroundClass(siteConfigContent, sectionIndex);
  if (actualClass !== expectedBackgroundClass) {
    errors.push(
      `siteConfig section ${sectionIndex} backgroundClass is "${actualClass ?? 'missing'}", expected "${expectedBackgroundClass}"`
    );
  }

  if (!sectionRendererUsesPresentationResolver(pageContent, rendererComponent)) {
    errors.push(`${rendererComponent} does not use resolveSectionBackground`);
  }

  if (hasInvalidNextJsPageExports(pageContent)) {
    errors.push('page.tsx contains invalid Next.js agent export stubs (must be sanitized)');
  }

  if (tailwindContent && !tailwindConfigCoversBackgroundClass(tailwindContent, expectedBackgroundClass)) {
    errors.push(`tailwind.config.js does not cover class "${expectedBackgroundClass}"`);
  }

  if (infraBaselineReady) {
    const unexpected = changedFiles.filter(
      (f) =>
        f !== 'src/lib/siteConfig.ts' &&
        f !== 'src/app/page.tsx' &&
        f !== 'tailwind.config.js'
    );
    if (unexpected.length > 0) {
      errors.push(`unexpected files changed when infra ready: ${unexpected.join(', ')}`);
    }
    if (changedFiles.includes('tailwind.config.js') && input.tailwindContentBefore) {
      const before = input.tailwindContentBefore;
      const hadFullScan = before.includes('./src/**/*');
      const hadSafelist = /\bsafelist\s*:/.test(before);
      if (
        hadFullScan &&
        hadSafelist &&
        tailwindConfigCoversBackgroundClass(before, expectedBackgroundClass)
      ) {
        errors.push('tailwind.config.js mutated unnecessarily when infra baseline is ready');
      }
    }
  }

  return errors;
}

/** Plan alias: hard gate — throws when source invariants are not satisfied. */
export function assertSectionColorEditReady(input: AssertSectionColorEditInvariantsInput): void {
  const errors = assertSectionColorEditInvariants(input);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}

async function wireTargetSectionOnly(
  options: WebsiteEditAgentOptions,
  componentName: string
): Promise<boolean> {
  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent || !sectionComponentUsesPresetBackground(pageContent, componentName)) {
    return false;
  }
  const upgraded = upgradeSectionComponentToPresentationResolver(pageContent, componentName);
  if (!upgraded.patched) return false;
  await writeWorkspaceRel(
    options,
    PAGE_TSX,
    sanitizeSourceForPublish(PAGE_TSX, upgraded.content)
  );
  return true;
}

/**
 * Apply a section background edit through one idempotent pipeline.
 */
export async function applySectionBackgroundEdit(
  input: ApplySectionBackgroundEditInput
): Promise<ApplySectionBackgroundEditResult> {
  const { workspace, sectionTarget, projectInfraStatus } = input;
  const options = workspaceOptions(workspace);
  const infraReady = projectInfraStatus.infraBaselineReady === true;

  const backgroundClass =
    input.backgroundClass?.trim() ||
    (input.colorName
      ? colorNameToBackgroundClass(input.colorName, workspace.ownerMessage)
      : '');
  if (!backgroundClass) {
    return {
      ok: false,
      backgroundClass: '',
      sectionIndex: sectionTarget.sectionIndex,
      sectionType: sectionTarget.sectionType,
      sectionTitle: sectionTarget.title ?? `section ${sectionTarget.sectionIndex}`,
      rendererComponent:
        sectionTarget.rendererComponent ??
        rendererComponentForSectionType(sectionTarget.sectionType),
      changedFiles: [],
      summary: '',
      invariantErrors: ['backgroundClass or colorName is required'],
    };
  }

  const sectionIndex = sectionTarget.sectionIndex;
  const rendererComponent =
    sectionTarget.rendererComponent ??
    rendererComponentForSectionType(sectionTarget.sectionType);

  const siteConfigBefore = await readWorkspaceRel(options, SITE_CONFIG);
  if (!siteConfigBefore) {
    return {
      ok: false,
      backgroundClass,
      sectionIndex,
      sectionType: sectionTarget.sectionType,
      sectionTitle: sectionTarget.title ?? `section ${sectionIndex}`,
      rendererComponent,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts is missing'],
    };
  }

  const parsed = parseSiteConfigSource(siteConfigBefore);
  const section = parsed?.sections?.[sectionIndex] as { title?: string; type?: string } | undefined;
  const sectionTitle =
    sectionTarget.title ?? section?.title ?? `section ${sectionIndex}`;
  const sectionType = sectionTarget.sectionType || String(section?.type ?? 'generic');

  const colorName = input.colorName ?? backgroundClass.replace(/^bg-/, '');
  const updated = input.backgroundClass
    ? updateSectionPresentationInSource(siteConfigBefore, sectionIndex, {
        backgroundClass,
      })
    : updateSectionBackgroundColorInSource(
        siteConfigBefore,
        sectionIndex,
        colorName,
        workspace.ownerMessage
      );

  if (!updated || updated === siteConfigBefore) {
    return {
      ok: false,
      backgroundClass,
      sectionIndex,
      sectionType,
      sectionTitle,
      rendererComponent,
      changedFiles: [],
      summary: '',
      invariantErrors: ['No siteConfig presentation change was applied'],
    };
  }

  const stamped = appendSiteConfigPresentationSyncExport(updated);
  await writeWorkspaceRel(options, SITE_CONFIG, stamped);

  const changedFiles: string[] = ['src/lib/siteConfig.ts'];
  const tailwindBefore = await readWorkspaceRel(options, TAILWIND_CONFIG);

  if (infraReady) {
    const pageBefore = await readWorkspaceRel(options, PAGE_TSX);
    const wired = await wireTargetSectionOnly(options, rendererComponent);
    if (wired) {
      changedFiles.push('src/app/page.tsx');
    } else if (
      pageBefore &&
      !sectionRendererUsesPresentationResolver(pageBefore, rendererComponent)
    ) {
      // Renderer exists but uses a non-preset pattern we cannot auto-wire.
    }

    const tailwindBeforeInfra = tailwindBefore;
    if (
      tailwindBeforeInfra &&
      !tailwindConfigCoversBackgroundClass(tailwindBeforeInfra, backgroundClass)
    ) {
      const patched = await ensureTailwindPresentationSupport(options);
      if (patched) changedFiles.push('tailwind.config.js');
    }
  } else {
    const readWrite = workspace.gateway
      ? {
          read: (rel: string) =>
            workspace.gateway!.readFile(rel).catch(() => null),
          write: (rel: string, content: string) =>
            workspace.gateway!.writeFile(rel, content),
        }
      : undefined;
    const repaired = await repairSectionPresentationWiringInWorkspace(
      workspace.workspacePath,
      readWrite
    );
    for (const rel of repaired) {
      if (!changedFiles.includes(rel)) changedFiles.push(rel);
    }
    const tailwindPatched = await ensureTailwindPresentationSupport(options);
    if (tailwindPatched && !changedFiles.includes('tailwind.config.js')) {
      changedFiles.push('tailwind.config.js');
    }
    if (!repaired.includes('src/app/page.tsx')) {
      const pageWired = await ensureLegacyPageReadsPresentation(options, rendererComponent);
      if (pageWired && !changedFiles.includes('src/app/page.tsx')) {
        changedFiles.push('src/app/page.tsx');
      }
    }
  }

  const siteConfigAfter = await readWorkspaceRel(options, SITE_CONFIG);
  const pageAfter = (await readWorkspaceRel(options, PAGE_TSX)) ?? '';
  const tailwindAfter = await readWorkspaceRel(options, TAILWIND_CONFIG);

  const invariantErrors = assertSectionColorEditInvariants({
    siteConfigContent: siteConfigAfter ?? stamped,
    pageContent: pageAfter,
    tailwindContent: tailwindAfter,
    sectionIndex,
    rendererComponent,
    expectedBackgroundClass: backgroundClass,
    infraBaselineReady: infraReady,
    changedFiles,
    tailwindContentBefore: tailwindBefore,
  });

  const summary = buildSummary(sectionTitle, backgroundClass);

  return {
    ok: invariantErrors.length === 0,
    backgroundClass,
    sectionIndex,
    sectionType,
    sectionTitle,
    rendererComponent,
    changedFiles,
    summary,
    invariantErrors,
  };
}

/** Build pipeline input from WebsiteEditAgentOptions and edit target plan fields. */
export function sectionBackgroundEditFromAgentOptions(
  options: WebsiteEditAgentOptions,
  sectionTarget: SectionBackgroundTarget,
  colorName: string
): ApplySectionBackgroundEditInput {
  return {
    workspace: {
      workspacePath: options.workspacePath,
      gateway: options.gateway,
      ownerMessage: options.ownerMessage,
    },
    sectionTarget,
    colorName,
    projectInfraStatus: {
      infraBaselineReady: options.infraBaselineReady === true,
    },
  };
}

/** Plan alias for unified section background pipeline entrypoint. */
export const applySectionBackgroundColorEdit = applySectionBackgroundEdit;
