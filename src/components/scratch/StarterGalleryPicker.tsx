'use client';

import { cn } from '@/lib/cn';
import { ACCENT, TEXT } from '@/content/productTheme';
import {
  getLayoutStartersByCategory,
  recommendLayoutStarterForIndustry,
  type LayoutStarter,
  type LayoutStarterId,
} from '@/lib/builder/layoutStarters';

interface Props {
  selectedId?: LayoutStarterId | null;
  onSelect: (starter: LayoutStarter) => void;
  disabled?: boolean;
  industry?: string;
  hideHeader?: boolean;
}

const DEFAULT_LAYOUT_PREVIEW_ACCENT = '#64748B';

/** Wireframe hero preview for layout starter cards and design panel. */
export function LayoutThumbnail({
  heroStyle,
  accentColor = DEFAULT_LAYOUT_PREVIEW_ACCENT,
}: {
  heroStyle: LayoutStarter['heroStyle'];
  accentColor?: string;
}) {
  if (heroStyle === 'centered') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3">
        <div className="h-1.5 w-10 rounded bg-white/80" />
        <div className="h-1 w-16 rounded bg-white/50" />
        <div className="mt-1 h-2 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
      </div>
    );
  }

  if (heroStyle === 'phone-first') {
    return (
      <div className="flex h-full flex-col justify-center gap-1 px-3">
        <div className="h-1.5 w-12 rounded bg-white/80" />
        <div className="h-2.5 w-14 rounded-full" style={{ backgroundColor: accentColor }} />
      </div>
    );
  }

  if (heroStyle === 'menu-feature') {
    return (
      <div className="grid h-full grid-cols-2 gap-1 p-2">
        <div className="rounded bg-white/20" />
        <div className="rounded bg-white/20" />
        <div className="col-span-2 rounded bg-white/30" />
      </div>
    );
  }

  if (heroStyle === 'appointment-hero') {
    return (
      <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-1 p-2">
        <div className="space-y-1">
          <div className="h-1.5 w-10 rounded bg-white/80" />
          <div className="h-1 w-8 rounded bg-white/50" />
        </div>
        <div className="rounded bg-white/25" />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[1.1fr_0.9fr] gap-1 p-2">
      <div className="space-y-1">
        <div className="h-1.5 w-10 rounded bg-white/80" />
        <div className="h-1 w-12 rounded bg-white/50" />
      </div>
      <div className="rounded bg-white/25" />
    </div>
  );
}

/** Grouped layout starter gallery for scratch intake (structure/hero only). */
export function StarterGalleryPicker({
  selectedId,
  onSelect,
  disabled = false,
  industry = '',
  hideHeader = false,
}: Props) {
  const grouped = getLayoutStartersByCategory();
  const recommended = industry.trim() ? recommendLayoutStarterForIndustry(industry) : null;

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div>
          <h3 className={cn('text-sm font-semibold', TEXT.primary)}>Choose a layout template</h3>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>
            Pick the page structure and hero style. Color theme is chosen separately below.
          </p>
          {recommended && (
            <p className="text-xs text-rose-700 mt-1">
              Recommended for {industry.trim()}: {recommended.name}
            </p>
          )}
        </div>
      )}

      {Object.entries(grouped).map(([useCase, starters]) => (
        <div key={useCase} className="space-y-2">
          <p className={cn('text-xs font-semibold uppercase tracking-wide', TEXT.muted)}>{useCase}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {starters.map((starter) => {
              const selected = starter.id === selectedId;
              const isRecommended = recommended?.id === starter.id;
              return (
                <button
                  key={starter.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(starter)}
                  className={cn(
                    'text-left rounded-xl border p-3 transition-all',
                    selected
                      ? 'border-rose-600 ring-2 ring-rose-500/20 bg-rose-50 shadow-rose-cta'
                      : 'border-[#d2d2d7]/80 hover:border-rose-200 bg-white',
                    disabled && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div
                    className="h-12 rounded-lg mb-2 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${DEFAULT_LAYOUT_PREVIEW_ACCENT} 0%, #0f172a 100%)`,
                    }}
                  >
                    <LayoutThumbnail heroStyle={starter.heroStyle} />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', TEXT.primary)}>{starter.name}</p>
                    </div>
                    {isRecommended && (
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', ACCENT.pill)}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className={cn('text-xs mt-1 line-clamp-2', TEXT.muted)}>{starter.description}</p>
                  {selected && (
                    <span className={cn('inline-block mt-2 text-xs font-medium', ACCENT.link)}>Selected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** @deprecated Use StarterGalleryPicker */
export { StarterGalleryPicker as LayoutStarterPicker };
