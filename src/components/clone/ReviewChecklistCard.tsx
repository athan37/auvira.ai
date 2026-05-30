'use client';

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
      <span className={`w-4 text-center text-sm ${found ? 'text-green-500' : 'text-yellow-500'}`}>
        {found ? '✓' : '⚠'}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
        <h2 className="font-medium text-green-800 text-sm">Please Review Before Building</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Confidence summary */}
        <p className="text-sm text-gray-700">{confidenceMessage}</p>

        {/* Checklist items */}
        <div className="space-y-1.5">
          <ChecklistItem label="Business name looks correct" found={checklist.businessNameFound} />
          <ChecklistItem label="Contact info looks correct" found={checklist.contactInfoFound} />
          <ChecklistItem label="Services look reasonable" found={checklist.servicesFound} />
          <ChecklistItem label="Proposed sections look good" found={checklist.sectionsFound} />
        </div>

        {/* Blocking issues */}
        {blockingIssues.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-red-700">Blocking issues — please resolve:</p>
            {blockingIssues.map((w, i) => (
              <p key={i} className="text-xs text-red-700">• {w}</p>
            ))}
          </div>
        )}

        {/* Review recommended */}
        {checklist.requiredWarnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-yellow-700">Review recommended:</p>
            {checklist.requiredWarnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">• {w}</p>
            ))}
          </div>
        )}

        {/* Optional missing info */}
        {checklist.optionalWarnings.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-gray-500">Optional — not required to build:</p>
            {checklist.optionalWarnings.map((w, i) => (
              <p key={i} className="text-xs text-gray-500">• {w}</p>
            ))}
          </div>
        )}

        {/* Critical content fidelity */}
        {criticalFidelity.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700">Critical content fidelity issues — build blocked:</p>
            {criticalFidelity.map((issue, i) => (
              <p key={i} className="text-xs text-red-700">• {issue}</p>
            ))}
          </div>
        )}

        {/* Warn-only content fidelity */}
        {warnFidelity.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-700">Content fidelity warnings:</p>
            {warnFidelity.map((issue, i) => (
              <p key={i} className="text-xs text-yellow-700">• {issue}</p>
            ))}
          </div>
        )}

        {contentFidelity?.passed && contentFidelity.issues.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700">✓ Content fidelity passed</p>
          </div>
        )}

        {contentFidelity?.passed && contentFidelity.issues.length > 0 && warnFidelity.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700">✓ No critical fidelity issues — you may build with warnings above</p>
          </div>
        )}

        {/* Missing details note */}
        {(!hasBlocking && (checklist.requiredWarnings.length > 0 || checklist.optionalWarnings.length > 0)) && (
          <p className="text-xs text-gray-400 italic">
            Missing details can be added later through chat.
          </p>
        )}
      </div>
    </div>
  );
}
