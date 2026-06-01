/**
 * Authoritative pipeline for section background color edits.
 * All section_style / update_section_style paths should delegate here.
 */

import {
  colorNameToBackgroundClass,
  extractSectionBackgroundClassFromMessage,
  formatSectionBackgroundChangeSummary,
} from '@/lib/builder/sectionPresentation';
import { normalizeTailwindBackgroundClass } from '@/lib/builder/tailwindBackgroundResolver';
import { normalizeGradientBackgroundClass } from '@/lib/builder/sectionPresentation';
import { tailwindConfigCoversBackgroundClass, isEmitableTailwindBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';
import { appendSiteConfigPresentationSyncExport, hasInvalidNextJsPageExports, sanitizeSourceForPublish } from '@/lib/site-manager/siteConfigAgentMarkers';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  updateSectionBackgroundColorInSource,
  updateSectionPresentationInSource,
} from './siteConfigMutations';
import {
  ensureLegacyPageReadsPresentation,
  ensureTailwindPresentationSupport,
  rendererComponentForSectionType,
  repairSectionPresentationWiringInWorkspace,
  upgradeSectionComponentToPresentationResolver,
  sectionComponentUsesPresetBackground,
} from './edit-shared/legacySectionPresentation';
import {
  extractSectionTitleCandidates,
  findBestSectionTitleMatch,
  titleMatchesIntent,
} from './edit-shared/resolveSectionTarget';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from './edit-shared/strategyContext';
import {
  presentationWiringIssues,
  sectionPresentationBackgroundClass,
  sectionPresentationCardClass,
  sectionRendererUsesPresentationResolver,
} from './previewReflectsSiteConfig';
import type { WebsiteEditAgentOptions } from './edit-shared/types';

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
  /** Which presentation token to update (default section wrapper background). */
  presentationField?: 'backgroundClass' | 'cardClass';
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
  presentationField?: 'backgroundClass' | 'cardClass';
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

function buildSummary(sectionTitle: string, backgroundClass: string, ownerMessage?: string): string {
  return formatSectionBackgroundChangeSummary(sectionTitle, backgroundClass, ownerMessage);
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
    presentationField = 'backgroundClass',
    infraBaselineReady,
    changedFiles,
  } = input;

  const actualClass =
    presentationField === 'cardClass'
      ? sectionPresentationCardClass(siteConfigContent, sectionIndex)
      : sectionPresentationBackgroundClass(siteConfigContent, sectionIndex);
  if (actualClass !== expectedBackgroundClass) {
    errors.push(
      `siteConfig section ${sectionIndex} ${presentationField} is "${actualClass ?? 'missing'}", expected "${expectedBackgroundClass}"`
    );
  }

  if (presentationField === 'backgroundClass' && !sectionRendererUsesPresentationResolver(pageContent, rendererComponent)) {
    errors.push(`${rendererComponent} does not use resolveSectionBackground`);
  }

  const wiringIssues = presentationWiringIssues(siteConfigContent, pageContent);
  const targetWiringIssue = wiringIssues.find((issue) => issue.startsWith(rendererComponent));
  if (targetWiringIssue) {
    errors.push(targetWiringIssue);
  }

  if (hasInvalidNextJsPageExports(pageContent)) {
    errors.push('page.tsx contains invalid Next.js agent export stubs (must be sanitized)');
  }

  if (tailwindContent && !tailwindConfigCoversBackgroundClass(tailwindContent, expectedBackgroundClass)) {
    errors.push(`tailwind.config.js does not cover class "${expectedBackgroundClass}"`);
  }

  if (!isEmitableTailwindBackgroundClass(expectedBackgroundClass)) {
    errors.push(`background class "${expectedBackgroundClass}" is not a valid Tailwind utility`);
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
  const presentationField = input.presentationField ?? 'backgroundClass';
  const options = workspaceOptions(workspace);
  const infraReady = projectInfraStatus.infraBaselineReady === true;

  const rawBackgroundClass =
    input.backgroundClass?.trim() ||
    (workspace.ownerMessage
      ? extractSectionBackgroundClassFromMessage(workspace.ownerMessage)
      : null) ||
    (input.colorName
      ? colorNameToBackgroundClass(input.colorName, workspace.ownerMessage)
      : '');
  const backgroundClass = rawBackgroundClass
    ? rawBackgroundClass.includes('gradient')
      ? normalizeGradientBackgroundClass(rawBackgroundClass, workspace.ownerMessage)
      : normalizeTailwindBackgroundClass(rawBackgroundClass, workspace.ownerMessage)
    : '';
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
    section?.title ?? sectionTarget.title ?? `section ${sectionIndex}`;
  const sectionType = sectionTarget.sectionType || String(section?.type ?? 'generic');

  const colorName = input.colorName ?? backgroundClass.replace(/^bg-/, '');
  const presentationPatch =
    presentationField === 'cardClass'
      ? { cardClass: backgroundClass }
      : { backgroundClass };
  const updated = input.backgroundClass
    ? updateSectionPresentationInSource(siteConfigBefore, sectionIndex, presentationPatch)
    : updateSectionBackgroundColorInSource(
        siteConfigBefore,
        sectionIndex,
        colorName,
        workspace.ownerMessage
      );

  const presentationAlreadyCorrect =
    presentationField === 'cardClass'
      ? sectionPresentationCardClass(siteConfigBefore, sectionIndex) === backgroundClass
      : sectionPresentationBackgroundClass(siteConfigBefore, sectionIndex) === backgroundClass;

  if ((!updated || updated === siteConfigBefore) && !presentationAlreadyCorrect) {
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

  const changedFiles: string[] = [];
  const siteConfigBase = updated && updated !== siteConfigBefore ? updated : siteConfigBefore;
  const stamped = appendSiteConfigPresentationSyncExport(siteConfigBase);
  if (stamped !== siteConfigBefore) {
    await writeWorkspaceRel(options, SITE_CONFIG, stamped);
    changedFiles.push('src/lib/siteConfig.ts');
  }
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
    presentationField,
    infraBaselineReady: infraReady,
    changedFiles,
    tailwindContentBefore: tailwindBefore,
  });

  const summary = buildSummary(sectionTitle, backgroundClass, workspace.ownerMessage);

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

export interface SectionColorEditGateInput {
  workspace: SectionPresentationWorkspace;
  projectInfraStatus: ProjectInfraStatus;
  /** When set, gate runs for section_style even without persisted presentation. */
  strategy?: string;
  ownerMessage?: string;
  /** Section the agent applied (preferred for owner-facing summary). */
  sectionIndex?: number;
  /** Agent summary — when set, gate must not replace it with a re-guessed title. */
  agentSummary?: string;
  /** Pre-edit siteConfig source for diff-based section detection. */
  beforeSiteConfig?: string;
  /** Re-run pipeline once when invariants fail (default true). */
  autoRepair?: boolean;
}

export interface SectionColorEditGateResult {
  ok: boolean;
  errors: string[];
  retried: boolean;
  summary?: string;
}

interface PresentationSectionTarget {
  sectionIndex: number;
  sectionType: string;
  title: string;
  rendererComponent: string;
  backgroundClass: string;
}

/** Sections with a persisted presentation.backgroundClass in siteConfig. */
export function listSectionsWithPresentationBackground(
  siteConfigContent: string
): PresentationSectionTarget[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed?.sections?.length) return [];

  const targets: PresentationSectionTarget[] = [];
  for (let i = 0; i < parsed.sections.length; i++) {
    const section = parsed.sections[i] as {
      type?: string;
      title?: string;
      presentation?: { backgroundClass?: string };
    };
    const backgroundClass = section.presentation?.backgroundClass?.trim();
    if (!backgroundClass) continue;
    const sectionType = String(section.type ?? 'generic');
    targets.push({
      sectionIndex: i,
      sectionType,
      title: section.title ?? `section ${i}`,
      rendererComponent: rendererComponentForSectionType(sectionType),
      backgroundClass,
    });
  }
  return targets;
}

/** Index of the section whose presentation.backgroundClass changed, if exactly one. */
export function findSectionIndexWithBackgroundClassChange(
  beforeSiteConfig: string,
  afterSiteConfig: string
): number | null {
  const beforeParsed = parseSiteConfigSource(beforeSiteConfig);
  const afterParsed = parseSiteConfigSource(afterSiteConfig);
  const afterSections = afterParsed?.sections ?? [];
  if (afterSections.length === 0) return null;

  let changedIndex: number | null = null;
  for (let i = 0; i < afterSections.length; i++) {
    const afterSection = afterSections[i] as {
      presentation?: { backgroundClass?: string };
    };
    const beforeSection = beforeParsed?.sections?.[i] as
      | { presentation?: { backgroundClass?: string } }
      | undefined;
    const afterBg = afterSection.presentation?.backgroundClass?.trim();
    const beforeBg = beforeSection?.presentation?.backgroundClass?.trim();
    if (afterBg && afterBg !== beforeBg) {
      if (changedIndex != null) return null;
      changedIndex = i;
    }
  }
  return changedIndex;
}

function resolveGateSummaryTarget(
  targets: PresentationSectionTarget[],
  ownerMessage: string,
  options: { sectionIndex?: number; beforeSiteConfig?: string; afterSiteConfig?: string }
): PresentationSectionTarget | null {
  if (targets.length === 0) return null;
  if (targets.length === 1) return targets[0]!;

  if (options.sectionIndex != null) {
    const byIndex = targets.find((t) => t.sectionIndex === options.sectionIndex);
    if (byIndex) return byIndex;
  }

  if (options.beforeSiteConfig && options.afterSiteConfig) {
    const diffIndex = findSectionIndexWithBackgroundClassChange(
      options.beforeSiteConfig,
      options.afterSiteConfig
    );
    if (diffIndex != null) {
      const byDiff = targets.find((t) => t.sectionIndex === diffIndex);
      if (byDiff) return byDiff;
    }
  }

  const titleCandidates = extractSectionTitleCandidates(ownerMessage);
  const catalogSections = targets.map((t) => ({
    index: t.sectionIndex,
    title: t.title,
    type: t.sectionType,
    hasImageItems: false,
    imageItemCount: 0,
    itemCount: 0,
  }));
  const best = findBestSectionTitleMatch(titleCandidates, catalogSections);
  if (best) {
    return targets.find((t) => t.sectionIndex === best.section.index) ?? null;
  }

  for (const candidate of titleCandidates) {
    const match = targets.find(
      (t) => titleMatchesIntent(t.title, candidate) || titleMatchesIntent(candidate, t.title)
    );
    if (match) return match;
  }

  return null;
}

function buildGateSummary(
  input: SectionColorEditGateInput,
  targets: PresentationSectionTarget[],
  afterSiteConfig: string,
  ownerMessage: string
): string | undefined {
  if (input.agentSummary?.trim()) {
    return undefined;
  }

  const target = resolveGateSummaryTarget(targets, ownerMessage, {
    sectionIndex: input.sectionIndex,
    beforeSiteConfig: input.beforeSiteConfig,
    afterSiteConfig,
  });
  if (!target) return undefined;

  return buildSummary(target.title, target.backgroundClass, ownerMessage);
}

function collectSectionColorInvariantErrors(
  siteConfigContent: string,
  pageContent: string,
  tailwindContent: string | null,
  targets: PresentationSectionTarget[],
  infraBaselineReady: boolean
): string[] {
  const errors: string[] = [];
  for (const target of targets) {
    const sectionErrors = assertSectionColorEditInvariants({
      siteConfigContent,
      pageContent,
      tailwindContent,
      sectionIndex: target.sectionIndex,
      rendererComponent: target.rendererComponent,
      expectedBackgroundClass: target.backgroundClass,
      infraBaselineReady,
      changedFiles: ['src/lib/siteConfig.ts', 'src/app/page.tsx', 'tailwind.config.js'],
    });
    errors.push(...sectionErrors);
  }
  return [...new Set(errors)];
}

/**
 * Post-apply gate for section background edits — verifies invariants and optionally
 * re-runs the unified pipeline once before validation/build gates.
 */
export async function enforceSectionColorEditReadyAfterApply(
  input: SectionColorEditGateInput
): Promise<SectionColorEditGateResult> {
  const { workspace, projectInfraStatus, strategy, autoRepair = true } = input;
  const options = workspaceOptions(workspace);
  const infraReady = projectInfraStatus.infraBaselineReady === true;

  const shouldGate = strategy === 'section_style';
  if (!shouldGate) {
    return { ok: true, errors: [], retried: false };
  }

  const readState = async () => {
    const siteConfigContent = (await readWorkspaceRel(options, SITE_CONFIG)) ?? '';
    const pageContent = (await readWorkspaceRel(options, PAGE_TSX)) ?? '';
    const tailwindContent = await readWorkspaceRel(options, TAILWIND_CONFIG);
    const targets = listSectionsWithPresentationBackground(siteConfigContent);
    return { siteConfigContent, pageContent, tailwindContent, targets };
  };

  let state = await readState();
  if (state.targets.length === 0) {
    return {
      ok: false,
      errors: ['section_style edit did not persist presentation.backgroundClass in siteConfig'],
      retried: false,
    };
  }

  let errors = collectSectionColorInvariantErrors(
    state.siteConfigContent,
    state.pageContent,
    state.tailwindContent,
    state.targets,
    infraReady
  );
  if (errors.length === 0) {
    const ownerMessage = input.ownerMessage ?? workspace.ownerMessage ?? '';
    return {
      ok: true,
      errors: [],
      retried: false,
      summary: buildGateSummary(input, state.targets, state.siteConfigContent, ownerMessage),
    };
  }

  if (!autoRepair) {
    return { ok: false, errors, retried: false };
  }

  for (const target of state.targets) {
    await applySectionBackgroundEdit({
      workspace,
      sectionTarget: {
        sectionIndex: target.sectionIndex,
        sectionType: target.sectionType,
        title: target.title,
        rendererComponent: target.rendererComponent,
      },
      backgroundClass: target.backgroundClass,
      projectInfraStatus,
    });
  }

  state = await readState();
  errors = collectSectionColorInvariantErrors(
    state.siteConfigContent,
    state.pageContent,
    state.tailwindContent,
    state.targets,
    infraReady
  );

  const ownerMessage = input.ownerMessage ?? workspace.ownerMessage ?? '';
  return {
    ok: errors.length === 0,
    errors,
    retried: true,
    summary: buildGateSummary(input, state.targets, state.siteConfigContent, ownerMessage),
  };
}
