import type {
  DesignBrief,
  FactualSiteData,
  ScratchIntake,
  SiteSpec,
  WebsitePlan,
} from './schemas';
import { convertPlanToSiteSpec } from './convertPlanToSiteSpec';
import { validateScratchContent } from './validateScratchContent';
import { validateScratchFidelity } from './validateScratchFidelity';
import { generateDesignBriefAgent, getDefaultDesignBrief } from './generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import type { TemplateSelection } from './selectTemplateAgent';
import type { GenerateWebsiteFilesResult } from '@/lib/builder/types';
import {
  getDefaultLayoutStarter,
  getLayoutStarter,
  type LayoutStarter,
} from '@/lib/builder/layoutStarters';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';
import { getCategoryPreset } from '@/lib/builder/categoryPresets';

export interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

export interface BuildWebsiteFromPlanInput {
  websitePlan: WebsitePlan;
  intake: ScratchIntake;
  projectName: string;
  layoutStarterId?: string;
  categoryPresetId?: string;
  validateBuild?: boolean;
  logPrefix?: string;
  /** Clone path: crawl ground truth for fidelity (e.g. testimonials from crawl). */
  factualSiteData?: FactualSiteData;
}

export interface BuildWebsiteFromPlanResult {
  ok: boolean;
  error?: string;
  stage?: string;
  stageLogs: StageLog[];
  duration_ms: number;
  siteSpec?: SiteSpec;
  designBrief?: DesignBrief;
  template?: TemplateSelection;
  layoutStarter?: LayoutStarter;
  layoutStarterId?: string;
  uniqueName?: string;
  generated?: GenerateWebsiteFilesResult;
  scratchValidation?: { ok: boolean; issues: string[] };
  fidelityValidation?: { ok: boolean; issues: string[] };
  generatedSiteValidation?: {
    ok: boolean;
    tempDir: string;
    logs: string;
    errors: string[];
    durationMs: number;
  };
}

function logStage(
  stageLogs: StageLog[],
  stage: string,
  logPrefix: string,
  duration_ms?: number
): StageLog {
  const entry: StageLog = { stage, timestamp: new Date().toISOString() };
  if (duration_ms !== undefined) entry.duration_ms = duration_ms;
  console.log(`[${logPrefix}] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  stageLogs.push(entry);
  return entry;
}

export function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
}

/**
 * Shared scratch/build pipeline: validate intake → siteSpec → design brief → files → build gate.
 */
export async function buildWebsiteFromPlan(
  input: BuildWebsiteFromPlanInput
): Promise<BuildWebsiteFromPlanResult> {
  const startTime = Date.now();
  const stageLogs: StageLog[] = [];
  const logPrefix = input.logPrefix || 'BUILD-FROM-PLAN';
  const { websitePlan, intake, validateBuild = true } = input;

  logStage(stageLogs, 'scratch_intake_received', logPrefix);

  logStage(stageLogs, 'scratch_content_validation_start', logPrefix);
  const scratchValidation = validateScratchContent(websitePlan, intake);
  logStage(stageLogs, 'scratch_content_validation_done', logPrefix, Date.now() - startTime);

  if (!scratchValidation.ok) {
    return {
      ok: false,
      error: `Content validation failed: ${scratchValidation.issues.join('; ')}`,
      stage: 'scratch_content_validation_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
      scratchValidation,
    };
  }

  logStage(stageLogs, 'scratch_fidelity_validation_start', logPrefix);
  const fidelityValidation = validateScratchFidelity(websitePlan, intake, {
    factualSiteData: input.factualSiteData,
  });
  logStage(stageLogs, 'scratch_fidelity_validation_done', logPrefix, Date.now() - startTime);

  if (!fidelityValidation.ok) {
    return {
      ok: false,
      error: `Intake fidelity check failed: ${fidelityValidation.issues.join('; ')}`,
      stage: 'scratch_fidelity_validation_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
      scratchValidation,
      fidelityValidation,
    };
  }

  logStage(stageLogs, 'plan_to_sitespec_start', logPrefix);
  let siteSpec: SiteSpec;
  try {
    siteSpec = convertPlanToSiteSpec(websitePlan, intake);
  } catch (error) {
    logStage(stageLogs, 'plan_to_sitespec_failed', logPrefix);
    return {
      ok: false,
      error: `Failed to convert plan to siteSpec: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stage: 'plan_to_sitespec_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
      scratchValidation,
      fidelityValidation,
    };
  }
  logStage(stageLogs, 'plan_to_sitespec_done', logPrefix, Date.now() - startTime);

  const categoryPreset = getCategoryPreset(input.categoryPresetId);
  const layoutStarter =
    getLayoutStarter(input.layoutStarterId) ??
    getLayoutStarter(websitePlan.suggestedTemplate?.layoutStarterId) ??
    getLayoutStarter(categoryPreset.layoutStarterId) ??
    getDefaultLayoutStarter();

  logStage(stageLogs, 'design_brief_start', logPrefix);
  let designBrief: DesignBrief;
  try {
    designBrief = await generateDesignBriefAgent(
      {
        businessName: websitePlan.businessName,
        industry: websitePlan.industry,
        description: websitePlan.positioning,
        services:
          websitePlan.contentPlan?.sections?.find((s) => s.type === 'services')?.contentNotes || [],
        location: intake.location,
        phone: intake.phone,
        email: intake.email,
        brandTone: websitePlan.suggestedTemplate?.category || intake.desiredStyle || 'professional',
        targetCustomers: websitePlan.targetCustomers,
      } as Record<string, unknown>,
      siteSpec as unknown as Record<string, unknown>,
      ''
    );
  } catch (error) {
    logStage(stageLogs, 'design_brief_failed', logPrefix);
    designBrief = getDefaultDesignBrief(
      (websitePlan.suggestedTemplate?.category as
        | 'legal'
        | 'healthcare'
        | 'home-services'
        | 'restaurant'
        | 'general-service') || 'general-service'
    );
    console.error(
      `[${logPrefix}] Design brief failed, using default: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  designBrief = {
    ...designBrief,
    layoutStrategy: layoutStarter.layoutStrategy,
  };
  logStage(stageLogs, 'design_brief_done', logPrefix, Date.now() - startTime);

  const normalizedTemplate = normalizeTemplateSelection(
    websitePlan.suggestedTemplate?.category ?? layoutStarter.category,
    websitePlan.suggestedTemplate?.variant ?? 'modern-clean'
  );
  const template: TemplateSelection = {
    category: normalizedTemplate.category,
    variant: normalizedTemplate.variant,
    reason:
      websitePlan.suggestedTemplate?.reason ||
      (input.layoutStarterId ? 'Selected by owner' : 'Default template selected.'),
  };

  const name = input.projectName || websitePlan.businessName || 'generated-website';
  const uniqueName = generateUniqueProjectName(name);

  logStage(stageLogs, 'build_files_start', logPrefix);
  let generated: GenerateWebsiteFilesResult;
  try {
    generated = generateWebsiteFiles(
      siteSpec,
      uniqueName,
      designBrief,
      template,
      layoutStarter,
      categoryPreset.id
    );
  } catch (error) {
    logStage(stageLogs, 'build_files_failed', logPrefix);
    return {
      ok: false,
      error: `File generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stage: 'build_files_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
      siteSpec,
      designBrief,
      template,
      layoutStarter,
      layoutStarterId: layoutStarter.id,
      uniqueName,
      scratchValidation,
      fidelityValidation,
    };
  }
  logStage(stageLogs, 'build_files_done', logPrefix, Date.now() - startTime);

  let generatedSiteValidation: BuildWebsiteFromPlanResult['generatedSiteValidation'] | undefined;

  if (validateBuild) {
    logStage(stageLogs, 'build_gate_start', logPrefix);
    const buildResult = await validateGeneratedSite({
      files: generated.files,
      projectName: uniqueName,
    });

    generatedSiteValidation = {
      ok: buildResult.ok,
      tempDir: buildResult.tempDir,
      logs: buildResult.logs,
      errors: buildResult.errors,
      durationMs: buildResult.durationMs,
    };

    if (!buildResult.ok) {
      logStage(stageLogs, 'build_gate_failed', logPrefix);
      return {
        ok: false,
        error: `Build validation failed: ${buildResult.errors.join('; ')}`,
        stage: 'generated_site_validation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        siteSpec,
        designBrief,
        template,
        layoutStarter,
        layoutStarterId: layoutStarter.id,
        uniqueName,
        generated,
        scratchValidation,
        fidelityValidation,
        generatedSiteValidation,
      };
    }
    logStage(stageLogs, 'build_gate_done', logPrefix, Date.now() - startTime);
  }

  return {
    ok: true,
    stage: 'generated_site_ready',
    stageLogs,
    duration_ms: Date.now() - startTime,
    siteSpec,
    designBrief,
    template,
    layoutStarter,
    layoutStarterId: layoutStarter.id,
    uniqueName,
    generated,
    scratchValidation,
    fidelityValidation,
    generatedSiteValidation,
  };
}

/**
 * Build intake from API body: prefer explicit intake, fall back to plan fields only when missing.
 */
export function resolveScratchIntake(
  websitePlan: WebsitePlan,
  intakeFromBody?: Partial<ScratchIntake>
): ScratchIntake {
  return {
    businessName: intakeFromBody?.businessName?.trim() || websitePlan.businessName,
    industry: intakeFromBody?.industry?.trim() || websitePlan.industry,
    location: intakeFromBody?.location?.trim() || '',
    services: intakeFromBody?.services?.trim() || '',
    targetCustomers:
      intakeFromBody?.targetCustomers?.trim() ||
      websitePlan.targetCustomers?.join(', ') ||
      '',
    mainGoal: intakeFromBody?.mainGoal?.trim() || websitePlan.primaryGoal,
    phone: intakeFromBody?.phone?.trim() || '',
    email: intakeFromBody?.email?.trim() || '',
    address: intakeFromBody?.address?.trim() || '',
    desiredStyle:
      intakeFromBody?.desiredStyle?.trim() ||
      websitePlan.suggestedTemplate?.category ||
      'professional',
    notes: intakeFromBody?.notes?.trim() || '',
  };
}
