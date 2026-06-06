'use client';

import { cn } from '@/lib/cn';
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
        <h2 className="text-sm font-semibold text-zinc-900">What kind of website?</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
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
                  ? 'border-zinc-900 ring-2 ring-zinc-900/10 shadow-md'
                  : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm',
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
              <p className="mt-3 text-sm text-zinc-600">{preset.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preset.exampleBusinesses.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              {layout ? (
                <p className="mt-2 text-xs text-zinc-400">Suggested layout: {layout.name}</p>
              ) : null}
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">
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
