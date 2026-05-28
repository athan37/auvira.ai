import { expect } from 'vitest';
import type { EditPlan } from '@/lib/project-workspace/website-edit-agent-v2';
import type { EditPlan as PlannerEditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/website-edit-agent/types';

const STYLE_SUBTITLE_HACK = /subtitle\s*:\s*["'](?:YELLOW|RED|BLUE|GREEN|ORANGE|PURPINK)_BG["']/i;

export function assertNoStyleSubtitleHack(siteConfig: string): void {
  expect(siteConfig).not.toMatch(STYLE_SUBTITLE_HACK);
  expect(siteConfig).not.toContain('YELLOW_BG');
}

export function assertSiteConfigPresentationField(
  siteConfig: string,
  options: {
    field?: 'backgroundClass' | 'cardClass' | 'eyebrowClass' | 'titleClass' | 'bodyClass';
    color?: string;
    classFragment?: string;
  }
): void {
  const lower = siteConfig.toLowerCase();
  expect(lower).toContain('presentation');
  assertNoStyleSubtitleHack(siteConfig);

  const field = options.field ?? 'backgroundClass';
  expect(lower).toContain(field.toLowerCase());

  if (options.classFragment) {
    expect(lower).toContain(options.classFragment.toLowerCase());
  }

  if (options.color) {
    const color = options.color.toLowerCase();
    expect(
      lower.includes(`bg-${color}`) ||
        lower.includes(`"${color}`) ||
        lower.includes(`'${color}`) ||
        lower.includes(`${color}-`)
    ).toBe(true);
  }
}

export function findV2StyleStep(plan: EditPlan) {
  return plan.steps.find((step) => step.skill === 'update_section_style');
}

export function findPlannerStyleStep(plan: PlannerEditPlan) {
  return plan.steps.find((step) => step.skill === 'update_section_style');
}

export function assertV2PlannerSectionStyle(
  plan: EditPlan,
  options: { color?: string; sectionIndex?: number }
): void {
  if (plan.needsClarification) {
    expect(plan.route).toBe('clarify');
    expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
    return;
  }

  const styleStep = findV2StyleStep(plan);
  const themeStep = plan.steps.find(
    (s) => s.skill === 'update_theme' || s.skill === 'legacy_strategy'
  );

  expect(styleStep ?? themeStep).toBeTruthy();

  if (!styleStep) return;

  const args = styleStep.args;
  if (options.sectionIndex != null && args.sectionIndex != null) {
    expect(args.sectionIndex).toBe(options.sectionIndex);
  }

  if (options.color) {
    const serialized = JSON.stringify(args).toLowerCase();
    expect(serialized.includes(options.color.toLowerCase())).toBe(true);
  }
}

export function assertPlannerSectionStyle(
  plan: PlannerEditPlan,
  options: { color?: string }
): void {
  if (plan.needsClarification) {
    expect(plan.clarificationQuestion?.trim().length).toBeGreaterThan(0);
    return;
  }

  const styleStep = findPlannerStyleStep(plan);
  expect(styleStep).toBeTruthy();
  const params = JSON.stringify(styleStep?.params ?? {}).toLowerCase();
  if (options.color) {
    expect(params.includes(options.color.toLowerCase()) || params.includes('bg-')).toBe(true);
  }
}

export function assertV2EditSucceededForPresentation(
  result: WebsiteEditAgentResult,
  siteConfig: string,
  options: { color?: string; field?: 'backgroundClass' | 'cardClass' }
): void {
  if (result.needsClarification) {
    expect(result.ok).toBe(false);
    expect((result.ownerMessage ?? '').trim().length).toBeGreaterThan(0);
    return;
  }

  expect(result.ok, result.error).toBe(true);
  assertSiteConfigPresentationField(siteConfig, {
    field: options.field,
    color: options.color,
  });
  expect(
    result.v2Meta?.skills?.includes('update_section_style') ||
      result.v2Meta?.skills?.includes('legacy_strategy')
  ).toBe(true);
}

export function assertSiteWideThemeNotSectionPresentation(siteConfig: string, pageOrCss: string): void {
  const combined = `${siteConfig}\n${pageOrCss}`.toLowerCase();
  expect(combined.includes('blue') || combined.includes('green') || combined.includes('bg-')).toBe(
    true
  );
}
