import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWebsiteFromPlan } from '@/lib/agent/buildWebsiteFromPlan';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import {
  scratchE2eExpectedHeadline,
  scratchE2eIntake,
  scratchE2ePlanAfterSelections,
  assertScratchE2ePlanSelections,
} from '../support/scratchE2eFixture';

const runBuildGate = process.env.RUN_BUILD_GATE === '1';

vi.mock('@/lib/agent/generateDesignBriefAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent/generateDesignBriefAgent')>();
  return {
    ...actual,
    generateDesignBriefAgent: vi.fn(async (_bp, _spec, _url) =>
      getDefaultDesignBrief('general-service')
    ),
  };
});

describe('scratch build from plan integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a full Next.js site from plan + intake (no LLM)', async () => {
    const websitePlan = scratchE2ePlanAfterSelections();
    assertScratchE2ePlanSelections(websitePlan);

    const result = await buildWebsiteFromPlan({
      websitePlan,
      intake: scratchE2eIntake,
      projectName: 'River City Plumbing',
      layoutStarterId: websitePlan.suggestedTemplate.layoutStarterId,
      validateBuild: false,
      logPrefix: 'TEST/SCRATCH/E2E',
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.stage).toBe('generated_site_ready');
    expect(result.generated?.files.length).toBeGreaterThanOrEqual(8);
    expect(result.scratchValidation?.ok).toBe(true);
    expect(result.fidelityValidation?.ok).toBe(true);
    expect(result.layoutStarterId).toBe('phone-first-service');

    const filePaths = result.generated!.files.map((f) => f.filePath);
    expect(filePaths).toContain('package.json');
    expect(filePaths).toContain('src/app/page.tsx');
    expect(filePaths).toContain('src/lib/siteConfig.ts');
    expect(filePaths).toContain('tailwind.config.js');

    const structuralErrors = validateGeneratedFiles(result.generated!.files);
    expect(structuralErrors, JSON.stringify(structuralErrors)).toEqual([]);

    const siteConfig =
      result.generated!.files.find((f) => f.filePath === 'src/lib/siteConfig.ts')?.content ?? '';
    const page = result.generated!.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';

    expect(siteConfig).toContain(scratchE2eExpectedHeadline);
    expect(siteConfig).toContain('512-555-9999');
    expect(siteConfig).toContain('hello@rivercityplumbing.test');
    expect(page).toContain('"heroStyle":"phone-first"');
  }, 60_000);

  it.runIf(runBuildGate)(
    'passes npm build gate for scratch-generated site',
    async () => {
      const result = await buildWebsiteFromPlan({
        websitePlan: scratchE2ePlanAfterSelections(),
        intake: scratchE2eIntake,
        projectName: 'river-city-plumbing-build-gate',
        layoutStarterId: 'phone-first-service',
        validateBuild: true,
        logPrefix: 'TEST/SCRATCH/BUILD-GATE',
      });

      expect(result.ok, result.error || result.generatedSiteValidation?.errors.join('; ')).toBe(true);
      expect(result.generatedSiteValidation?.ok).toBe(true);
    },
    300_000
  );
});
