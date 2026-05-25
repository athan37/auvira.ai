'use client';

import { cn } from '@/lib/cn';
import { getTemplateGallery, type TemplateGalleryEntry } from '@/lib/builder/templateGallery';

interface Props {
  selectedCategory?: string;
  selectedVariant?: string;
  onSelect: (entry: TemplateGalleryEntry) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
}

/** Thumbnail grid for picking a website color theme (clone, scratch, or review). */
export function TemplateGalleryPicker({
  selectedCategory,
  selectedVariant,
  onSelect,
  disabled = false,
  title = 'Choose a color theme',
  description = 'Pick the look for your new site. You can change it again before building.',
}: Props) {
  const templates = getTemplateGallery();

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {templates.map((entry) => {
          const selected =
            entry.category === selectedCategory && entry.variant === selectedVariant;
          return (
            <button
              key={entry.variant}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(entry)}
              className={cn(
                'text-left rounded-xl border p-3 transition-all',
                selected
                  ? 'border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div
                className="h-10 rounded-lg mb-2"
                style={{
                  background: `linear-gradient(135deg, ${entry.accentColor} 0%, #0f172a 100%)`,
                }}
              />
              <p className="text-sm font-medium text-zinc-900">{entry.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{entry.description}</p>
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
