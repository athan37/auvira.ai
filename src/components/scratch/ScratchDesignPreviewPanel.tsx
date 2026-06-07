'use client';

import { cn } from '@/lib/cn';
import { ACCENT, BORDER, TEXT } from '@/content/productTheme';
import type { LayoutStarter } from '@/lib/builder/layoutStarters';
import { recommendLayoutStarterForIndustry } from '@/lib/builder/layoutStarters';
import type { TemplateGalleryEntry } from '@/lib/builder/templateGallery';
import { LayoutThumbnail } from '@/components/scratch/StarterGalleryPicker';

interface ReadinessItem {
  label: string;
  done: boolean;
}

interface Props {
  businessName?: string;
  industry?: string;
  selectedStarter?: LayoutStarter | null;
  selectedTheme: TemplateGalleryEntry;
  variant?: 'full' | 'compact';
  /** Sticky on desktop — disable when pickers sit below in the same column (review step). */
  sticky?: boolean;
  showReadiness?: boolean;
  readinessItems?: ReadinessItem[];
  className?: string;
  children?: React.ReactNode;
}

function PreviewMockup({
  starter,
  accentColor,
  compact,
}: {
  starter: LayoutStarter | null | undefined;
  accentColor: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg border',
        BORDER.hairline,
        compact ? 'h-16 w-24 shrink-0' : 'h-32 w-full'
      )}
      style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, #0f172a 100%)`,
      }}
    >
      <div className="absolute inset-0">
        {starter ? (
          <LayoutThumbnail heroStyle={starter.heroStyle} accentColor={accentColor} />
        ) : (
          <div className="flex h-full items-center justify-center px-3">
            <div className="h-1.5 w-16 rounded bg-white/40" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Sticky design preview and selection summary for scratch intake / review. */
export function ScratchDesignPreviewPanel({
  businessName,
  industry,
  selectedStarter,
  selectedTheme,
  variant = 'full',
  sticky = true,
  showReadiness = false,
  readinessItems = [],
  className,
  children,
}: Props) {
  const recommended =
    industry?.trim() && selectedStarter
      ? recommendLayoutStarterForIndustry(industry)
      : null;
  const isRecommended = recommended?.id === selectedStarter?.id;

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border bg-white p-3 lg:hidden',
          BORDER.hairline,
          className
        )}
      >
        <PreviewMockup starter={selectedStarter} accentColor={selectedTheme.accentColor} compact />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('truncate text-sm font-medium', TEXT.primary)}>
            {businessName?.trim() || 'Your business'}
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedStarter && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', ACCENT.pill)}>
                {selectedStarter.name}
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: selectedTheme.accentColor }}
            >
              {selectedTheme.name}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 space-y-4 self-start',
        BORDER.hairline,
        sticky && 'lg:sticky lg:top-[4.5rem] lg:z-10',
        className
      )}
    >
      <div>
        <h3 className={cn('text-sm font-semibold', TEXT.primary)}>Design preview</h3>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>Layout structure with your chosen color theme</p>
      </div>

      <PreviewMockup starter={selectedStarter} accentColor={selectedTheme.accentColor} />

      <div className="space-y-2">
        <p className={cn('text-sm font-medium truncate', TEXT.primary)}>
          {businessName?.trim() || 'Your business name'}
        </p>
        {industry?.trim() && (
          <p className={cn('text-xs truncate', TEXT.muted)}>{industry.trim()}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {selectedStarter ? (
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ACCENT.pill)}>
            {selectedStarter.name}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            No layout selected
          </span>
        )}
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: selectedTheme.accentColor }}
        >
          {selectedTheme.name}
        </span>
        {isRecommended && industry?.trim() && (
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ACCENT.pill)}>
            Recommended for {industry.trim()}
          </span>
        )}
      </div>

      {showReadiness && readinessItems.length > 0 && (
        <ul className={cn('space-y-1.5 border-t pt-3', BORDER.hairline)}>
          {readinessItems.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  item.done ? 'bg-rose-100 text-rose-700' : 'bg-[#f5f5f7] text-[#86868b]'
                )}
              >
                {item.done ? '✓' : '·'}
              </span>
              <span className={item.done ? TEXT.primary : TEXT.muted}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {children && (
        <div className={cn('space-y-3 border-t pt-3', BORDER.hairline)}>{children}</div>
      )}
    </div>
  );
}
