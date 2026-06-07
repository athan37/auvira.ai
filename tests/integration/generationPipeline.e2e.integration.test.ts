/**
 * End-to-end generation pipeline smoke (no live crawl / no GitLab).
 *
 * - Scratch: full buildWebsiteFromPlan → validated Next.js files
 * - Clone: generateCloneWebsiteFiles from saved preview spec
 * - Observability (gated): live Site Monitor sync for clone + generate turns
 *
 * Run:
 *   npm run test:generation-e2e
 *   RUN_OBSERVABILITY_INTEGRATION_TESTS=true npm run test:generation-e2e
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWebsiteFromPlan } from '@/lib/agent/buildWebsiteFromPlan';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { generateCloneWebsiteFiles } from '@/lib/clone/cloneTemplateSelection';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  ensureObservabilityRegistration,
  recordObservabilityTurn,
} from '@/lib/observability';
import { recordCloneObservabilityTurn } from '@/lib/observability/recordCloneTurn';
import {
  OBSERVABILITY_INTEGRATION_TIMEOUT_MS,
  observabilityIntegrationDescribe,
  shouldRunObservabilityIntegrationTests,
} from '../observability/testGate';
import {
  scratchE2eExpectedHeadline,
  scratchE2eIntake,
  scratchE2ePlanAfterSelections,
  assertScratchE2ePlanSelections,
} from '../support/scratchE2eFixture';

const clonePreviewSiteSpec = {
  siteTitle: 'Pipeline E2E HVAC',
  tagline: 'Generation pipeline integration test',
  primaryCTA: 'Get started',
  secondaryCTA: 'Contact',
  sections: [
    { type: 'hero', title: 'Pipeline E2E HVAC', body: 'Trusted local HVAC', items: [] },
    {
      type: 'services',
      title: 'Everything Your HVAC Business Needs',
      body: 'Services for contractors',
      items: ['Web design', 'Lead capture'],
    },
    { type: 'contact', title: 'Contact', body: 'Reach us today', items: ['Phone: 555-0100'] },
  ],
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#1E3A5F'] },
};

vi.mock('@/lib/agent/generateDesignBriefAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent/generateDesignBriefAgent')>();
  return {
    ...actual,
    generateDesignBriefAgent: vi.fn(async () => getDefaultDesignBrief('general-service')),
  };
});

describe('generation pipeline E2E (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scratch: builds a full Next.js site from plan + intake', async () => {
    const websitePlan = scratchE2ePlanAfterSelections();
    assertScratchE2ePlanSelections(websitePlan);

    const result = await buildWebsiteFromPlan({
      websitePlan,
      intake: scratchE2eIntake,
      projectName: 'River City Plumbing E2E',
      layoutStarterId: websitePlan.suggestedTemplate.layoutStarterId,
      validateBuild: false,
      logPrefix: 'TEST/GENERATION/SCRATCH',
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.stage).toBe('generated_site_ready');
    expect(result.generated?.files.length).toBeGreaterThanOrEqual(8);
    expect(result.scratchValidation?.ok).toBe(true);
    expect(result.fidelityValidation?.ok).toBe(true);

    const structuralErrors = validateGeneratedFiles(result.generated!.files);
    expect(structuralErrors, JSON.stringify(structuralErrors)).toEqual([]);

    const siteConfig =
      result.generated!.files.find((f) => f.filePath === 'src/lib/siteConfig.ts')?.content ?? '';
    expect(siteConfig).toContain(scratchE2eExpectedHeadline);
  }, 60_000);

  it('clone: generates site files from preview spec without crawl', () => {
    const designBrief = getDefaultDesignBrief('home-services');
    const generated = generateCloneWebsiteFiles(
      clonePreviewSiteSpec,
      'Pipeline E2E HVAC',
      designBrief,
      {
        category: 'home-services',
        variant: 'modern-clean',
        reason: 'E2E pipeline test',
      }
    );

    expect(generated.files.length).toBeGreaterThanOrEqual(8);

    const structuralErrors = validateGeneratedFiles(generated.files);
    expect(structuralErrors, JSON.stringify(structuralErrors)).toEqual([]);

    const siteConfig =
      generated.files.find((f) => f.filePath === 'src/lib/siteConfig.ts')?.content ?? '';
    const page = generated.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';

    expect(siteConfig).toContain('Pipeline E2E HVAC');
    expect(page).toContain('hero');
  });
});

observabilityIntegrationDescribe('generation pipeline observability (live monitor)', () => {
  const BASE_ENV = { ...process.env };
  const jobId = `vitest-gen-e2e-${Date.now()}`;
  const projectId = `vitest-gen-project-${Date.now()}`;

  beforeEach(() => {
    process.env = { ...BASE_ENV };
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    process.env.OBSERVABILITY_API_URL =
      process.env.OBSERVABILITY_API_URL?.trim() ||
      'https://la-mue-site-monitor-production.up.railway.app';
    process.env.OBSERVABILITY_TIMEOUT_MS = '15000';
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it(
    'records clone process + build-preview turns with synced traces',
    async () => {
      const processMeta = await recordCloneObservabilityTurn({
        jobId,
        createdProjectId: projectId,
        projectTitle: 'Pipeline E2E Clone',
        phase: 'process',
        turnId: `${jobId}-process`,
        turnIndex: 1,
        userMessage: `Generate site plan from https://example.com (${jobId})`,
        reply: 'Fidelity passed — E2E smoke',
        outcome: 'success',
        verifyPass: true,
        phaseEvents: [
          { name: 'site_spec_llm', durationMs: 1200, outcome: 'success' },
          { name: 'content_fidelity', durationMs: 80, outcome: 'passed' },
        ],
        latencyMs: 1280,
      });

      expect(processMeta).not.toBeNull();
      expect(processMeta?.arize.syncStatus).toBe('synced');
      expect(processMeta?.arize.externalId).toBeTruthy();

      const buildMeta = await recordCloneObservabilityTurn({
        jobId,
        createdProjectId: projectId,
        projectTitle: 'Pipeline E2E Clone',
        phase: 'build-preview',
        turnId: `${jobId}-build`,
        turnIndex: 2,
        userMessage: 'Build preview workspace',
        reply: 'Build gate passed — E2E smoke',
        outcome: 'success',
        buildGatePass: true,
        siteConfigParsed: {
          businessName: 'Pipeline E2E HVAC',
          sections: clonePreviewSiteSpec.sections,
        },
        latencyMs: 4200,
      });

      expect(buildMeta).not.toBeNull();
      expect(buildMeta?.arize.syncStatus).toBe('synced');
      expect(buildMeta?.arize.externalId).toBeTruthy();

      // eslint-disable-next-line no-console -- operator visibility for live E2E
      console.info('[generation-e2e observability clone]', {
        processTraceId: processMeta?.arize.externalId,
        processGrade: processMeta?.arize.grade,
        buildTraceId: buildMeta?.arize.externalId,
        buildGrade: buildMeta?.arize.grade,
      });
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );

  it(
    'records scratch generate turn with synced trace',
    async () => {
      await ensureObservabilityRegistration({
        projectId,
        title: 'Pipeline E2E Scratch',
      });

      const timer = new EditStepTimer();
      const meta = await recordObservabilityTurn({
        projectId,
        turnId: `${projectId}-generate`,
        turnIndex: 1,
        userMessage: 'Build website from scratch plan (E2E smoke)',
        reply: 'Generated site ready — build gate passed',
        outcome: 'success',
        verifyPass: true,
        buildGatePass: true,
        editTimer: timer,
        requestedBuilderType: 'la_mue_generate',
        flowType: 'generate',
        latencyMs: 3500,
      });

      expect(meta).not.toBeNull();
      expect(meta?.arize.syncStatus).toBe('synced');
      expect(meta?.arize.externalId).toBeTruthy();

      // eslint-disable-next-line no-console -- operator visibility for live E2E
      console.info('[generation-e2e observability generate]', {
        traceId: meta?.arize.externalId,
        grade: meta?.arize.grade,
        overallScore: meta?.arize.overallScore,
      });
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );
});

describe('generation pipeline E2E gate', () => {
  it('documents observability live suite when credentials present', () => {
    if (shouldRunObservabilityIntegrationTests()) {
      expect(process.env.OBSERVABILITY_API_KEY?.trim()).toBeTruthy();
    } else {
      expect(true).toBe(true);
    }
  });
});
