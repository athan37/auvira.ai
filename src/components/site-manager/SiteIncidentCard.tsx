'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { TEXT } from '@/content/productTheme';
import { SITE_MANAGER_COPY } from '@/lib/owner/ownerCopy';

interface Props {
  headline: string;
  body: string;
  proposalTitle?: string;
  proposalSummary?: string;
  fixing?: boolean;
  onApplyFix?: () => void;
  onDismiss?: () => void;
}

export function SiteIncidentCard({
  headline,
  body,
  proposalTitle,
  proposalSummary,
  fixing,
  onApplyFix,
  onDismiss,
}: Props) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-950">{headline}</p>
        <p className="text-sm text-amber-900 mt-1">{body}</p>
      </div>
      {proposalTitle && (
        <div className="rounded-md bg-white border border-amber-100 p-2 text-sm">
          <p className="font-medium">{proposalTitle}</p>
          {proposalSummary && <p className={cn('text-xs mt-1', TEXT.muted)}>{proposalSummary}</p>}
        </div>
      )}
      <div className="flex gap-2">
        {onApplyFix && (
          <Button type="button" size="sm" disabled={fixing} onClick={onApplyFix}>
            {fixing ? SITE_MANAGER_COPY.updatingLive : SITE_MANAGER_COPY.applyFix}
          </Button>
        )}
        {onDismiss && (
          <Button type="button" variant="secondary" size="sm" disabled={fixing} onClick={onDismiss}>
            {SITE_MANAGER_COPY.ignore}
          </Button>
        )}
      </div>
    </div>
  );
}
