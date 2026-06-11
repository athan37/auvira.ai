'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';

export type IntentProbeResult = {
  intent: string | null;
  extractedColors: string[];
  unresolved: boolean;
  error?: string;
};

/** Group 4 — on-demand POST /intent probe result. */
export function ObservabilityIntentProbePanel({
  result,
  loading,
}: {
  result?: IntentProbeResult | null;
  loading?: boolean;
}) {
  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Intent probe</h2>
        <p className={`text-xs mt-0.5 ${TEXT.muted}`}>Monitor POST /intent for the probe message</p>
      </CardHeader>
      <CardBody>
        {loading ? (
          <p className={`text-sm ${TEXT.muted}`}>Probing intent…</p>
        ) : result?.error && !result.intent ? (
          <EmptyState title="Probe failed" description={result.error} className="py-6" />
        ) : !result?.intent ? (
          <EmptyState
            title="No probe yet"
            description="Click Probe intent to resolve the probe message via Site Monitor."
            className="py-6"
          />
        ) : (
          <div className="space-y-3">
            <p className={`text-sm leading-relaxed ${TEXT.primary}`}>{result.intent}</p>
            {result.unresolved ? (
              <Badge tone="warning">Needs clarification</Badge>
            ) : null}
            {result.extractedColors.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs ${TEXT.muted}`}>Extracted colors:</span>
                {result.extractedColors.map((color) => (
                  <Badge key={color} tone="warning" className="capitalize">
                    {color}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
