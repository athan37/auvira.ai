'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface EditErrorTraceProps {
  trace: string;
  jobId?: string;
  stage?: string;
}

/** Copy-friendly failure trace shown under chat error messages. */
export default function EditErrorTrace({ trace, jobId, stage }: EditErrorTraceProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(trace);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="mt-2 rounded-md border border-red-200 bg-red-50/80 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-red-100 bg-red-100/60">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-wide text-red-800 hover:underline"
        >
          {expanded ? 'Hide' : 'Show'} error trace
          {stage ? ` (${stage})` : ''}
        </button>
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy trace'}
        </Button>
      </div>
      {expanded && (
        <pre className="text-[10px] leading-relaxed p-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-red-950 select-all">
          {trace}
        </pre>
      )}
      {jobId && (
        <p className="px-2 pb-1.5 text-[10px] text-red-700 font-mono">
          jobId: {jobId}
          {stage ? ` · stage: ${stage}` : ''}
        </p>
      )}
    </div>
  );
}
