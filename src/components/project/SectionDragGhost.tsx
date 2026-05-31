'use client';

import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';

interface Props {
  payload: SelectedSectionPayload;
  x: number;
  y: number;
}

function sectionLabel(payload: SelectedSectionPayload): string {
  if (payload.sectionType === 'hero' || payload.sectionIndex < 0) return 'Hero';
  return payload.sectionTitle?.trim() || payload.sectionType;
}

/** Floating ghost while dragging a preview section toward chat. */
export function SectionDragGhost({ payload, x, y }: Props) {
  const label = sectionLabel(payload);

  return (
    <div
      className="fixed z-[100] pointer-events-none px-3 py-2 rounded-lg border-2 border-blue-500 bg-blue-600 text-white text-sm font-medium shadow-xl"
      style={{ left: x + 12, top: y + 12 }}
      aria-hidden
    >
      {label}
    </div>
  );
}
