'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { TEXT } from '@/content/productTheme';

type IntentLookupResult = {
  sentence: string | null;
  extractedColor: string | null;
  unresolved?: boolean;
};

/** Fetch Monitor POST /intent for a historical turn user message (demo). */
export function MonitorTurnIntentCell({
  projectId,
  userMessage,
  conversationId,
}: {
  projectId: string;
  userMessage: string;
  conversationId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntentLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIntent = async () => {
    if (result) {
      setOpen((value) => !value);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ userMessage });
      if (conversationId) qs.set('conversationId', conversationId);
      const res = await fetch(
        `/api/projects/${projectId}/observability/intent?${qs.toString()}`
      );
      const json = (await res.json()) as IntentLookupResult & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setError(json.error ?? 'Intent lookup failed');
        return;
      }
      setResult({
        sentence: json.sentence,
        extractedColor: json.extractedColor,
        unresolved: json.unresolved,
      });
      setOpen(true);
    } catch {
      setError('Intent lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void loadIntent()}
        disabled={loading}
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-amber-50 text-amber-800/90 ring-1 ring-amber-200/80',
          'hover:bg-amber-100/80 transition-colors disabled:opacity-60'
        )}
      >
        {loading ? '…' : result ? (open ? 'Hide' : 'Intent') : 'Intent'}
      </button>
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
      {open && result?.sentence ? (
        <div
          className={cn(
            'absolute right-0 z-20 mt-1 w-[min(17rem,70vw)]',
            'rounded-xl border border-amber-100/90 bg-white/95 shadow-lg backdrop-blur-sm',
            'px-2.5 py-2 text-[11px] leading-relaxed text-neutral-700'
          )}
        >
          <p className="mb-1">{result.sentence}</p>
          {result.extractedColor ? (
            <Badge tone="warning" className="capitalize">
              color: {result.extractedColor}
            </Badge>
          ) : result.unresolved ? (
            <span className={TEXT.muted}>Color not resolved</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
