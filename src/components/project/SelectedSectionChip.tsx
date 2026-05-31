'use client';

import { useEffect, useState } from 'react';
import type { SelectedSection } from '@/lib/preview/sectionSelectionProtocol';

interface Props {
  selection: SelectedSection;
  onClear: () => void;
  pulseKey?: number;
  interactive?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

/** Chip showing the preview-pinned section above the chat input. */
export function SelectedSectionChip({
  selection,
  onClear,
  pulseKey = 0,
  interactive = false,
  onHoverStart,
  onHoverEnd,
}: Props) {
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (pulseKey <= 0) return;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 1200);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  const label =
    selection.kind === 'hero'
      ? 'Hero'
      : selection.sectionTitle?.trim() || selection.sectionType;

  return (
    <div
      data-section-chat-label
      className={`flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg border text-blue-900 text-xs ${
        interactive
          ? 'cursor-pointer border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 transition-colors'
          : 'border-blue-200 bg-blue-50'
      } ${pulsing ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
      role="status"
      aria-live="polite"
      title={interactive ? `Highlight ${label} in preview` : undefined}
      onMouseEnter={interactive ? onHoverStart : undefined}
      onMouseLeave={interactive ? onHoverEnd : undefined}
    >
      <span className="font-medium shrink-0">Editing:</span>
      <span className="truncate flex-1" title={label}>
        {label}
        {selection.kind === 'section' && selection.sectionType ? (
          <span className="text-blue-700/70 ml-1">({selection.sectionType})</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 p-0.5 rounded hover:bg-blue-100 text-blue-800"
        aria-label={`Clear selected section ${label}`}
        title="Clear selection"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
