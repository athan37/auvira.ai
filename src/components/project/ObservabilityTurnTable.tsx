import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import type { ProjectObservabilityTurnRow } from '@/lib/metrics/aggregateObservabilityMetrics';
import { gradeToBadgeTone, outcomeToBadgeTone } from '@/lib/observability/observabilityUiHelpers';

const PHOENIX_APP_URL =
  process.env.NEXT_PUBLIC_PHOENIX_APP_URL?.replace(/\/$/, '') ||
  'https://app.phoenix.arize.com';

const PHOENIX_TRACE_TEMPLATE =
  process.env.NEXT_PUBLIC_PHOENIX_TRACE_URL_TEMPLATE?.trim() || '';

function traceHref(externalId: string): string {
  if (PHOENIX_TRACE_TEMPLATE.includes('{traceId}')) {
    return PHOENIX_TRACE_TEMPLATE.replace('{traceId}', encodeURIComponent(externalId));
  }
  return PHOENIX_APP_URL;
}

/** Turn history table for project observability dashboard. */
export function ObservabilityTurnTable({ turns }: { turns: ProjectObservabilityTurnRow[] }) {
  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Turn history</h2>
      </CardHeader>
      <CardBody className="p-0">
        {turns.length === 0 ? (
          <EmptyState
            title="No traced turns yet"
            description="Edits recorded to Site Monitor will appear here with grades and trace links."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f5f5f7]/80 text-left text-xs uppercase tracking-wide text-[#86868b]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Outcome</th>
                  <th className="px-4 py-2.5 font-medium">Grade</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-4 py-2.5 font-medium">Hints</th>
                  <th className="px-4 py-2.5 font-medium">Files</th>
                  <th className="px-4 py-2.5 font-medium">Reply</th>
                  <th className="px-4 py-2.5 font-medium">Trace</th>
                </tr>
              </thead>
              <tbody>
                {turns.map((row) => {
                  const coachingCount = row.coachingHints?.length ?? 0;
                  const guidanceCount = row.guidanceHints?.length ?? 0;
                  const hintCount = coachingCount + guidanceCount;

                  return (
                    <tr
                      key={`${row.messageAt}-${row.externalId ?? row.syncStatus}`}
                      className="border-t border-[#d2d2d7]/60 hover:bg-black/[0.03] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-[#6e6e73] whitespace-nowrap">
                        {new Date(row.messageAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.outcome ? (
                          <Badge tone={outcomeToBadgeTone(row.outcome)} className="capitalize">
                            {row.outcome}
                          </Badge>
                        ) : (
                          <span className={TEXT.tertiary}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.grade ? (
                          <Badge tone={gradeToBadgeTone(row.grade)}>{row.grade}</Badge>
                        ) : (
                          <span className={TEXT.tertiary}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#1d1d1f]">
                        {row.overallScore != null ? row.overallScore.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6e6e73]">
                        {hintCount > 0 ? hintCount : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[#1d1d1f]">
                        {row.changedFilesCount > 0 ? row.changedFilesCount : '—'}
                      </td>
                      <td
                        className="px-4 py-2.5 max-w-[200px] truncate text-xs text-[#6e6e73]"
                        title={row.replyPreview}
                      >
                        {row.replyPreview ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.externalId ? (
                          <a
                            href={traceHref(row.externalId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-500 hover:underline font-mono"
                            title={row.externalId}
                          >
                            {row.externalId.slice(0, 12)}…
                          </a>
                        ) : (
                          <span className={`text-xs ${TEXT.tertiary}`}>{row.syncStatus}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
