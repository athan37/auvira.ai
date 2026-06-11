import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonitorTurnIntentCell } from '@/components/project/MonitorTurnIntentCell';
import { TEXT } from '@/content/productTheme';
import type { MonitorDashboardTurnRow } from '@/lib/observability/parseMonitorDashboard';
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

function truncateMessage(message: string, max = 200): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max)}…`;
}

function formatIssues(row: MonitorDashboardTurnRow): string {
  if (row.issueLabels && row.issueLabels.length > 0) return row.issueLabels.join(', ');
  if (row.issueCodes && row.issueCodes.length > 0) return row.issueCodes.join(', ');
  return '—';
}

/** Group 8 — Site Monitor turn history (newest first). */
export function ObservabilityTurnTable({
  projectId,
  conversationId,
  turns,
  analyzed,
}: {
  projectId: string;
  conversationId?: string;
  turns?: MonitorDashboardTurnRow[];
  analyzed?: boolean;
}) {
  const rows = turns ?? [];

  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Turn history</h2>
          <span className={`text-[11px] ${TEXT.tertiary}`}>Source: Site Monitor</span>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {!analyzed ? (
          <EmptyState
            title="Not analyzed yet"
            description="Analyze a session to load turn history."
            className="py-10"
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No traced turns yet"
            description="Edits recorded to Site Monitor will appear here with grades and trace links."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="glass-panel text-left text-xs uppercase tracking-wide text-[#86868b]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Turn #</th>
                  <th className="px-4 py-2.5 font-medium">Message</th>
                  <th className="px-4 py-2.5 font-medium">Grade</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-4 py-2.5 font-medium">Outcome</th>
                  <th className="px-4 py-2.5 font-medium">Gates</th>
                  <th className="px-4 py-2.5 font-medium">Issues</th>
                  <th className="px-4 py-2.5 font-medium">Latency</th>
                  <th className="px-4 py-2.5 font-medium">Files</th>
                  <th className="px-4 py-2.5 font-medium">Intent</th>
                  <th className="px-4 py-2.5 font-medium">Trace</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.turnId}
                    className="border-t border-[#d2d2d7]/60 hover:bg-black/[0.03] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-[#6e6e73]">{row.turnIndex}</td>
                    <td
                      className="px-4 py-2.5 max-w-[200px] truncate text-xs text-[#1d1d1f]"
                      title={row.userMessage}
                    >
                      {truncateMessage(row.userMessage)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.grade ? (
                        <Badge tone={gradeToBadgeTone(row.grade)}>{row.grade}</Badge>
                      ) : (
                        <span className={TEXT.tertiary}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#1d1d1f]">
                      {row.overallScore != null ? row.overallScore.toFixed(2) : '—'}
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
                    <td className="px-4 py-2.5 text-xs text-[#6e6e73]">
                      {row.verifyPass == null && row.buildGatePass == null
                        ? '—'
                        : `${row.verifyPass ? 'V' : 'v'}/${row.buildGatePass ? 'B' : 'b'}`}
                    </td>
                    <td
                      className="px-4 py-2.5 max-w-[140px] truncate text-xs text-[#6e6e73]"
                      title={formatIssues(row)}
                    >
                      {formatIssues(row)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6e6e73]">
                      {row.latencyMs != null ? `${row.latencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#1d1d1f]">
                      {row.changedFileCount != null && row.changedFileCount > 0
                        ? row.changedFileCount
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <MonitorTurnIntentCell
                        projectId={projectId}
                        userMessage={row.userMessage}
                        conversationId={conversationId}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {row.traceId ? (
                        <a
                          href={traceHref(row.traceId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-600 hover:text-brand-500 hover:underline font-mono"
                          title={row.traceId}
                        >
                          {row.traceId.slice(0, 12)}…
                        </a>
                      ) : (
                        <span className={`text-xs ${TEXT.tertiary}`}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
