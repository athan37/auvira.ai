'use client';

import { OWNER_COPY } from '@/lib/owner/ownerCopy';

interface Props {
  hasUnpublishedChanges: boolean;
}

export function UnpublishedChangesBadge({ hasUnpublishedChanges }: Props) {
  if (!hasUnpublishedChanges) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/80 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
      <span className="text-xs text-amber-900 font-medium">{OWNER_COPY.unsavedDraft}</span>
    </div>
  );
}