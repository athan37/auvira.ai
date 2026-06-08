'use client';

import { Badge } from '@/components/ui/Badge';
import { BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface ReviewChecklist {
  businessNameFound: boolean;
  contactInfoFound: boolean;
  servicesFound: boolean;
  sectionsFound: boolean;
  requiredWarnings: string[];
  optionalWarnings: string[];
}

interface ContentFidelity {
  passed: boolean;
  issues: string[];
  criticalIssues?: string[];
  warnIssues?: string[];
  hasCriticalFailures?: boolean;
}

interface Props {
  checklist: ReviewChecklist;
  contentFidelity?: ContentFidelity | null;
  confidenceMessage: string;
  blockingIssues: string[];
}

function ChecklistItem({ label, found }: { label: string; found: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn('w-4 text-center text-sm', found ? 'text-rose-600' : 'text-yellow-500')}>
        {found ? '✓' : '⚠'}
      </span>
      <span className={cn('text-sm', TEXT.primary)}>{label}</span>
    </div>
  );
}

export default function ReviewChecklistCard({
  checklist,
  contentFidelity,
  confidenceMessage,
  blockingIssues,
}: Props) {
  const hasBlocking = blockingIssues.length > 0;
  const criticalFidelity = contentFidelity?.criticalIssues?.length
    ? contentFidelity.criticalIssues
    : contentFidelity?.hasCriticalFailures
    ? contentFidelity.issues
    : [];
  const warnFidelity = contentFidelity?.warnIssues ?? [];

  return (
    <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b bg-rose-50/60', BORDER.hairline)}>
        <h2 className={cn('font-medium text-sm text-rose-900')}>Please Review Before Building</h2>
      </div>
      <div className="p-4 space-y-4">
        <p className={cn('text-sm', TEXT.primary)}>{confidenceMessage}</p>

        <div className="space-y-1.5">
          <ChecklistItem label="Business name looks correct" found={checklist.businessNameFound} />
          <ChecklistItem label="Contact info looks correct" found={checklist.contactInfoFound} />
          <ChecklistItem label="Services look reasonable" found={checklist.servicesFound} />
          <ChecklistItem label="Proposed sections look good" found={checklist.sectionsFound} />
        </div>

        {blockingIssues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-red-700">Blocking issues — please resolve:</p>
            {blockingIssues.map((w, i) => (
              <p key={i} className="text-xs text-red-700">• {w}</p>
            ))}
          </div>
        )}

        {checklist.requiredWarnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-yellow-700">Review recommended:</p>
            {checklist.requiredWarnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">• {w}</p>
            ))}
          </div>
        )}

        {checklist.optionalWarnings.length > 0 && (
          <div className={cn('border rounded-lg p-3 space-y-1', SURFACE.alt, BORDER.hairline)}>
            <p className={cn('text-xs font-semibold', TEXT.muted)}>Optional — not required to build:</p>
            {checklist.optionalWarnings.map((w, i) => (
              <p key={i} className={cn('text-xs', TEXT.muted)}>• {w}</p>
            ))}
          </div>
        )}

        {criticalFidelity.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800">Content review notes (does not block build):</p>
            {criticalFidelity.map((issue, i) => (
              <p key={i} className="text-xs text-amber-800">• {issue}</p>
            ))}
          </div>
        )}

        {warnFidelity.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-700">Content fidelity warnings:</p>
            {warnFidelity.map((issue, i) => (
              <p key={i} className="text-xs text-yellow-700">• {issue}</p>
            ))}
          </div>
        )}

        {contentFidelity?.passed && contentFidelity.issues.length === 0 && (
          <div className="flex items-center gap-2">
            <Badge tone="success">Content fidelity passed</Badge>
          </div>
        )}

        {contentFidelity?.passed && contentFidelity.issues.length > 0 && warnFidelity.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge tone="success">You may build — review warnings above before deploying</Badge>
          </div>
        )}

        {(!hasBlocking && (checklist.requiredWarnings.length > 0 || checklist.optionalWarnings.length > 0)) && (
          <p className={cn('text-xs italic', TEXT.tertiary)}>
            Missing details can be added later through chat.
          </p>
        )}
      </div>
    </div>
  );
}
