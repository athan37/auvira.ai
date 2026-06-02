'use client';

import { cn } from '@/lib/cn';
import {
  getLayoutStarters,
  type LayoutStarter,
  type LayoutStarterId,
} from '@/lib/builder/layoutStarters';
import { getTemplateGallery } from '@/lib/builder/templateGallery';

interface Props {
  selectedId?: LayoutStarterId | null;
  onSelect: (starter: LayoutStarter) => void;
  disabled?: boolean;
}

const ACCENT_BY_VARIANT = Object.fromEntries(
  getTemplateGallery().map((entry) => [entry.variant, entry.accentColor])
) as Record<string, string>;

/** Grid picker for layout + theme starters (scratch flow). */
export function LayoutStarterPicker({ selectedId, onSelect, disabled = false }: Props) {
  const starters = getLayoutStarters();

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Choose a layout starter</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Pick a starting layout and color theme. You can change content after the site is built.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {starters.map((starter) => {
          const selected = starter.id === selectedId;
          const accent = ACCENT_BY_VARIANT[starter.variant] ?? '#2563EB';
          return (
            <button
              key={starter.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(starter)}
              className={cn(
                'text-left rounded-xl border p-3 transition-all',
                selected
                  ? 'border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div
                className="h-10 rounded-lg mb-2 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${accent} 0%, #0f172a 100%)`,
                }}
              >
                <div className="absolute inset-2 rounded border border-white/20 bg-white/10" />
              </div>
              <p className="text-sm font-medium text-zinc-900">{starter.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{starter.description}</p>
              {selected && (
                <span className="inline-block mt-2 text-xs font-medium text-zinc-700">Selected</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
