'use client';

import { getTemplateDisplayName } from '@/lib/builder/templateGallery';
import { getLayoutStarterDisplayName } from '@/lib/builder/layoutStarters';
import { isOwnerChosenTemplate } from '@/lib/builder/ownerTemplateSelection';

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
    <div className="border-l-2 border-brand-200 pl-3 py-1">
      <div className="text-sm font-medium text-zinc-800">{title}</div>
      {purpose && <div className="text-xs text-zinc-500 mt-0.5">{purpose}</div>}
    </div>
  );
}

export default function ProposedPlanCard({ plan, suggestedTemplate, showRawPlan = false }: Props) {
  if (!plan) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
          <h2 className="font-medium text-zinc-800 text-sm">Proposed Website Plan</h2>
        </div>
        <div className="p-4 text-center text-zinc-400 text-sm">Proposed plan not available yet.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
        <h2 className="font-medium text-zinc-800 text-sm">Proposed Website Plan</h2>
        <p className="text-xs text-zinc-500 mt-0.5">What your new website will look like</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Site identity */}
        <div className="space-y-1">
          {plan.siteTitle && (
            <div className="text-sm">
              <span className="text-zinc-500">Site title: </span>
              <span className="font-semibold text-zinc-900">{plan.siteTitle}</span>
            </div>
          )}
          {plan.tagline && (
            <div className="text-sm text-zinc-600 italic">{plan.tagline}</div>
          )}
          {plan.positioningStatement && (
            <div className="text-sm">
              <span className="text-zinc-500">Positioning: </span>
              <span className="text-zinc-700">{plan.positioningStatement}</span>
            </div>
          )}
        </div>

        {/* CTAs */}
        {(plan.primaryCTA || plan.secondaryCTA) && (
          <div className="flex gap-3 text-xs">
            {plan.primaryCTA && (
              <span className="bg-brand-50 text-brand-700 px-2 py-1 rounded">
                Primary CTA: {plan.primaryCTA}
              </span>
            )}
            {plan.secondaryCTA && (
              <span className="bg-zinc-50 text-zinc-600 px-2 py-1 rounded">
                Secondary CTA: {plan.secondaryCTA}
              </span>
            )}
          </div>
        )}

        {/* Sections */}
        {plan.sections && plan.sections.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase mb-2">Suggested sections</div>
            <div className="space-y-2">
              {plan.sections.map((section, i) => (
                <SectionItem key={i} section={section} />
              ))}
            </div>
          </div>
        )}

        {/* Layout + color templates */}
        {suggestedTemplate && (
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Layout template</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm bg-brand-100 text-brand-700 px-2 py-1 rounded">
                  {suggestedTemplate.layoutStarterId
                    ? getLayoutStarterDisplayName(suggestedTemplate.layoutStarterId)
                    : 'Default layout'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Color theme</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                  {getTemplateDisplayName(suggestedTemplate.variant)}
                </span>
                {isOwnerChosenTemplate(suggestedTemplate.reason) && (
                  <span className="text-xs text-brand-600">Your choice</span>
                )}
              </div>
              {suggestedTemplate.reason && !isOwnerChosenTemplate(suggestedTemplate.reason) && (
                <p className="text-xs text-zinc-400 mt-1">{suggestedTemplate.reason}</p>
              )}
            </div>
          </div>
        )}

        {/* Raw plan toggle */}
        {showRawPlan && (
          <details className="mt-2">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">
              View raw plan
            </summary>
            <pre className="mt-2 text-xs bg-zinc-900 text-zinc-300 p-3 rounded overflow-x-auto max-h-64">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}