'use client';

import { getTemplateDisplayName } from '@/lib/builder/templateGallery';
import { getLayoutStarterDisplayName } from '@/lib/builder/layoutStarters';
import { isOwnerChosenTemplate } from '@/lib/builder/ownerTemplateSelection';
import { ACCENT, BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface Section {
  type: string;
  title?: string;
  description?: string;
  purpose?: string;
}

interface ProposedWebsitePlan {
  siteTitle?: string;
  tagline?: string;
  primaryCTA?: string;
  secondaryCTA?: string;
  positioningStatement?: string;
  sections?: Section[];
  requiredMissingInfo?: string[];
  riskWarnings?: string[];
}

interface SuggestedTemplate {
  category: string;
  variant: string;
  reason?: string;
  layoutStarterId?: string;
}

interface Props {
  plan: ProposedWebsitePlan | null;
  suggestedTemplate?: SuggestedTemplate | null;
  showRawPlan?: boolean;
}

function SectionItem({ section }: { section: Section }) {
  const title = section.title || section.type;
  const purpose = section.purpose || section.description || '';
  return (
    <div className="border-l-2 border-rose-200 pl-3 py-1">
      <div className={cn('text-sm font-medium', TEXT.primary)}>{title}</div>
      {purpose && <div className={cn('text-xs mt-0.5', TEXT.muted)}>{purpose}</div>}
    </div>
  );
}

export default function ProposedPlanCard({ plan, suggestedTemplate, showRawPlan = false }: Props) {
  if (!plan) {
    return (
      <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
        <div className={cn('px-4 py-3 border-b', SURFACE.alt, BORDER.hairline)}>
          <h2 className={cn('font-medium text-sm', TEXT.primary)}>Proposed Website Plan</h2>
        </div>
        <div className={cn('p-4 text-center text-sm', TEXT.tertiary)}>Proposed plan not available yet.</div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b', SURFACE.alt, BORDER.hairline)}>
        <h2 className={cn('font-medium text-sm', TEXT.primary)}>Proposed Website Plan</h2>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>What your new website will look like</p>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          {plan.siteTitle && (
            <div className="text-sm">
              <span className={TEXT.muted}>Site title: </span>
              <span className={cn('font-semibold', TEXT.primary)}>{plan.siteTitle}</span>
            </div>
          )}
          {plan.tagline && (
            <div className={cn('text-sm italic', TEXT.muted)}>{plan.tagline}</div>
          )}
          {plan.positioningStatement && (
            <div className="text-sm">
              <span className={TEXT.muted}>Positioning: </span>
              <span className={TEXT.primary}>{plan.positioningStatement}</span>
            </div>
          )}
        </div>

        {(plan.primaryCTA || plan.secondaryCTA) && (
          <div className="flex gap-3 text-xs">
            {plan.primaryCTA && (
              <span className={cn('px-2 py-1 rounded', ACCENT.pill)}>
                Primary CTA: {plan.primaryCTA}
              </span>
            )}
            {plan.secondaryCTA && (
              <span className={cn('px-2 py-1 rounded', SURFACE.alt, TEXT.muted)}>
                Secondary CTA: {plan.secondaryCTA}
              </span>
            )}
          </div>
        )}

        {plan.sections && plan.sections.length > 0 && (
          <div>
            <div className={cn('text-xs font-semibold uppercase mb-2', TEXT.muted)}>Suggested sections</div>
            <div className="space-y-2">
              {plan.sections.map((section, i) => (
                <SectionItem key={i} section={section} />
              ))}
            </div>
          </div>
        )}

        {plan.requiredMissingInfo && plan.requiredMissingInfo.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-yellow-700">Missing information from crawl:</p>
            {plan.requiredMissingInfo.map((item, i) => (
              <p key={i} className="text-xs text-yellow-700">• {item}</p>
            ))}
          </div>
        )}

        {plan.riskWarnings && plan.riskWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-800">Plan warnings:</p>
            {plan.riskWarnings.map((item, i) => (
              <p key={i} className="text-xs text-amber-800">• {item}</p>
            ))}
          </div>
        )}

        {suggestedTemplate && (
          <div className="space-y-3">
            <div>
              <div className={cn('text-xs font-semibold uppercase mb-1', TEXT.muted)}>Layout template</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm px-2 py-1 rounded', ACCENT.pill)}>
                  {suggestedTemplate.layoutStarterId
                    ? getLayoutStarterDisplayName(suggestedTemplate.layoutStarterId)
                    : 'Default layout'}
                </span>
              </div>
            </div>
            <div>
              <div className={cn('text-xs font-semibold uppercase mb-1', TEXT.muted)}>Color theme</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200/80">
                  {getTemplateDisplayName(suggestedTemplate.variant)}
                </span>
                {isOwnerChosenTemplate(suggestedTemplate.reason) && (
                  <span className="text-xs text-rose-600">Your choice</span>
                )}
              </div>
              {suggestedTemplate.reason && !isOwnerChosenTemplate(suggestedTemplate.reason) && (
                <p className={cn('text-xs mt-1', TEXT.tertiary)}>{suggestedTemplate.reason}</p>
              )}
            </div>
          </div>
        )}

        {showRawPlan && (
          <details className="mt-2">
            <summary className={cn('text-xs cursor-pointer hover:text-[#1d1d1f]', TEXT.muted)}>
              View raw plan
            </summary>
            <pre className="mt-2 text-xs bg-[#1d1d1f] text-[#f5f5f7] p-3 rounded-xl overflow-x-auto max-h-64">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
