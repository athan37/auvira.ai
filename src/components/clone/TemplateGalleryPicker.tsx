'use client';

import { cn } from '@/lib/cn';
import { getTemplateGallery, type TemplateGalleryEntry } from '@/lib/builder/templateGallery';
import { ACCENT, BORDER, RADIUS, TEXT } from '@/content/productTheme';

interface Props {
  selectedCategory?: string;
  selectedVariant?: string;
  onSelect: (entry: TemplateGalleryEntry) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  hideHeader?: boolean;
}

/** Thumbnail grid for picking a website color theme (clone, scratch, or review). */
export function TemplateGalleryPicker({
  selectedCategory,
  selectedVariant,
  onSelect,
  disabled = false,
  title = 'Choose a color theme',
  description = 'Pick the look for your new site. You can change it again before building.',
  hideHeader = false,
}: Props) {
  const templates = getTemplateGallery();

  return (
    <div className="space-y-2">
      {!hideHeader && (
        <div>
          <h3 className={cn('text-sm font-semibold', TEXT.primary)}>{title}</h3>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>{description}</p>
        </div>
      )}
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
                'text-left border p-3 transition-all',
                RADIUS.card,
                selected
                  ? cn('border-rose-400 ring-2 ring-rose-400/30 bg-rose-50/40 shadow-rose-cta', ACCENT.ring)
                  : cn('border-[#d2d2d7]/80 hover:border-rose-200 bg-white', BORDER.hairline),
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div
                className="h-10 rounded-lg mb-2"
                style={{
                  background: `linear-gradient(135deg, ${entry.accentColor} 0%, #0f172a 100%)`,
                }}
              />
              <p className={cn('text-sm font-medium', TEXT.primary)}>{entry.name}</p>
              <p className={cn('text-xs mt-0.5 line-clamp-2', TEXT.muted)}>{entry.description}</p>
              {selected && (
                <span className="inline-block mt-2 text-xs font-medium text-rose-700">Selected</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
