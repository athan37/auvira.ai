'use client';

import { cn } from '@/lib/cn';
import { ACCENT, BORDER, TEXT } from '@/content/productTheme';
import {
  getCategoryPreset,
  listCategoryPresets,
  type WebsiteCategoryId,
} from '@/lib/builder/categoryPresets';
import { getLayoutStarter } from '@/lib/builder/layoutStarters';

interface Props {
  selectedId?: WebsiteCategoryId | null;
  onSelect: (categoryId: WebsiteCategoryId) => void;
  disabled?: boolean;
}

const GRADIENT_CLASS: Record<WebsiteCategoryId, string> = {
  service_business: 'from-sky-500 to-blue-700',
  store_menu: 'from-amber-500 to-orange-600',
  fundraising_event: 'from-rose-500 to-pink-700',
  portfolio_resume: 'from-violet-500 to-indigo-700',
  landing_page: 'from-emerald-500 to-teal-700',
};

/** Mini wireframe preview for selected category card. */
function CategoryWireframe({ categoryId }: { categoryId: WebsiteCategoryId }) {
  const preset = getCategoryPreset(categoryId);
  const moduleCount = preset.actionModules.length;
  return (
    <div className="mt-3 space-y-1 rounded-lg bg-white/15 p-2">
      <div className="h-1.5 w-2/3 rounded bg-white/70" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: Math.min(3, moduleCount + 2) }).map((_, i) => (
          <div key={i} className="h-6 rounded bg-white/25" />
        ))}
      </div>
    </div>
  );
}

/** Category chooser for scratch website creation. */
export function CategoryPresetPicker({ selectedId, onSelect, disabled }: Props) {
  const presets = listCategoryPresets();

  return (
    <div className="space-y-4">
      <div>
        <h2 className={cn('text-sm font-semibold', TEXT.primary)}>What kind of website?</h2>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>
          Pick a category — we&apos;ll add the right sections, packages, and action buttons.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const selected = selectedId === preset.id;
          const layout = getLayoutStarter(preset.layoutStarterId);
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(preset.id)}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-all',
                selected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-cta-blue'
                  : cn('hover:shadow-sm', BORDER.hairline, 'hover:border-rose-200'),
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'rounded-xl bg-gradient-to-br p-4 text-white',
                  GRADIENT_CLASS[preset.id]
                )}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">
                  {preset.visualAccent.eyebrowLabel}
                </p>
                <p className="mt-1 text-lg font-semibold">{preset.label}</p>
                {selected ? <CategoryWireframe categoryId={preset.id} /> : null}
              </div>
              <p className={cn('mt-3 text-sm', TEXT.muted)}>{preset.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preset.exampleBusinesses.map((chip) => (
                  <span
                    key={chip}
                    className={cn('rounded-full px-2 py-0.5 text-xs', ACCENT.pill)}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              {layout ? (
                <p className={cn('mt-2 text-xs', TEXT.tertiary)}>Suggested layout: {layout.name}</p>
              ) : null}
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs text-white">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
