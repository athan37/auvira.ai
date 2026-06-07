'use client';

import { cn } from '@/lib/cn';
import { TEXT } from '@/content/productTheme';

interface Props {
  visible: boolean;
  pulse?: boolean;
  onDismiss?: () => void;
}

/** First-run hint encouraging drag-to-chat preview targeting. */
export function PreviewTargetHint({ visible, pulse = false, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'mb-2 rounded-lg glass-panel px-3 py-2.5 text-xs',
        TEXT.primary,
        pulse && 'animate-pulse ring-2 ring-rose-400/60 ring-offset-1'
      )}
      role="note"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 leading-relaxed">
          Drag a section or element here to target your edit.
        </p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'shrink-0 rounded p-0.5',
              TEXT.tertiary,
              'hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
            )}
            aria-label="Dismiss targeting hint"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
