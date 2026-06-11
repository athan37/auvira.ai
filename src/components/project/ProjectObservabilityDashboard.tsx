'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ObservabilityChartsPanel } from '@/components/project/ObservabilityChartsPanel';
import { ObservabilityExecutivePanel } from '@/components/project/ObservabilityExecutivePanel';
import { ObservabilityImprovementBriefPanel } from '@/components/project/ObservabilityImprovementBriefPanel';
import { ObservabilityIntentProfilePanel } from '@/components/project/ObservabilityIntentProfilePanel';
import { ObservabilityLearningPanel } from '@/components/project/ObservabilityLearningPanel';
import { ObservabilityLiveContextPanel } from '@/components/project/ObservabilityLiveContextPanel';
import { ObservabilityStatCards } from '@/components/project/ObservabilityStatCards';
import { ObservabilityTurnTable } from '@/components/project/ObservabilityTurnTable';
import { TEXT } from '@/content/productTheme';
import type { MonitorDashboardCards } from '@/lib/observability/parseMonitorDashboard';
import type { MonitorIntentProfileView } from '@/lib/observability/parseIntentProfile';
import type { MonitorDashboardView } from '@/lib/observability/parseMonitorDashboard';
import { buildSessionSummaryCards } from '@/lib/observability/sessionSummaryCards';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

type ConversationOption = { id: string; title: string; turnCount?: number };

type BootstrapResponse = {
  ok: boolean;
  projectName?: string;
  monitorEnabled?: boolean;
  defaultConversationId?: string;
  conversations?: ConversationOption[];
  conversationsHint?: string;
  health?: {
    mongo?: { ok?: boolean };
    phoenix?: { enabled?: boolean; mcp_connected?: boolean };
  } | null;
  error?: string;
};

type AnalyzeResponse = {
  ok: boolean;
  conversationId?: string;
  sessionSummary?: MonitorDashboardCards | null;
  intentProfile?: MonitorIntentProfileView | null;
  coachingContext?: {
    raw: Record<string, unknown>;
    parsed: ObservabilityCoachingContext;
  } | null;
  developerAnalytics?: {
    executiveKpis: MonitorDashboardView['executiveKpis'];
    learningMetrics: MonitorDashboardView['learningMetrics'];
    charts: MonitorDashboardView['charts'];
    turns: MonitorDashboardView['turns'];
    improvementBrief?: string;
    improvementBriefSections?: MonitorDashboardView['improvementBriefSections'];
  } | null;
  errors?: Array<{ source: string; status: number; message: string }>;
  error?: string;
};

function resolveConversationOptions(bootstrap: BootstrapResponse): ConversationOption[] {
  if (bootstrap.conversations && bootstrap.conversations.length > 0) {
    return bootstrap.conversations;
  }
  if (bootstrap.defaultConversationId) {
    return [{ id: bootstrap.defaultConversationId, title: 'Editor chat' }];
  }
  return [];
}

function ObservabilityDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card animate-pulse h-24" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card animate-pulse h-20" />
        ))}
      </div>
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 glass-card animate-pulse h-64" />
        <div className="lg:col-span-7 glass-card animate-pulse h-64" />
      </div>
    </div>
  );
}

/** Per-project analytics dashboard — Site Monitor session analyze. */
export function ProjectObservabilityDashboard({ projectId }: { projectId: string }) {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [conversationId, setConversationId] = useState('');
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const runAnalyze = useCallback(
    async (targetConversationId: string) => {
      if (!targetConversationId) return;
      setAnalyzing(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/observability/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: targetConversationId }),
        });
        const json = (await res.json()) as AnalyzeResponse;
        setAnalyzeData(json);
        setAnalyzed(json.ok);
      } catch {
        setAnalyzeData({ ok: false, error: 'Analyze request failed' });
        setAnalyzed(false);
      } finally {
        setAnalyzing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    setConversationId('');
    setAnalyzed(false);
    setAnalyzeData(null);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/observability/bootstrap`);
        const json = (await res.json()) as BootstrapResponse;
        if (!cancelled) {
          setBootstrap(json);
          const options = resolveConversationOptions(json);
          if (options.length === 1) {
            setConversationId(options[0].id);
          } else if (json.defaultConversationId) {
            setConversationId(json.defaultConversationId);
          }
        }
      } catch {
        if (!cancelled) setBootstrap({ ok: false, error: 'Failed to load bootstrap' });
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (bootstrapLoading || !bootstrap?.ok || !bootstrap.monitorEnabled || !conversationId) return;
    void runAnalyze(conversationId);
  }, [bootstrap, bootstrapLoading, conversationId, runAnalyze]);

  const monitorEnabled = bootstrap?.monitorEnabled ?? false;
  const health = bootstrap?.health;
  const conversationOptions = bootstrap ? resolveConversationOptions(bootstrap) : [];
  const singleConversation = conversationOptions.length === 1;
  const summaryCards = buildSessionSummaryCards(analyzeData?.sessionSummary);
  const dev = analyzeData?.developerAnalytics;

  return (
    <div className="px-3 lg:px-4 pb-8 max-w-5xl mx-auto w-full">
      <header className="py-6">
        <h1 className={`text-2xl font-semibold tracking-[-0.02em] ${TEXT.primary}`}>
          Analytics
        </h1>
        <p className={`text-sm mt-1 ${TEXT.muted}`}>
          Site Monitor session quality, intent profile, coaching context, and turn history.
        </p>
      </header>

      {bootstrapLoading ? (
        <ObservabilityDashboardSkeleton />
      ) : !bootstrap?.ok ? (
        <Alert variant="error">{bootstrap?.error ?? 'Unauthorized or unavailable'}</Alert>
      ) : (
        <div className="space-y-6">
          {!monitorEnabled ? (
            <Alert variant="warning">Site Monitor is not enabled. Enable observability to analyze sessions.</Alert>
          ) : null}

          <div className="glass-card rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {health ? (
                <>
                  {health.mongo?.ok != null ? (
                    <Badge tone={health.mongo.ok ? 'success' : 'warning'}>
                      Mongo {health.mongo.ok ? 'ok' : 'down'}
                    </Badge>
                  ) : null}
                  {health.phoenix?.enabled != null ? (
                    <Badge tone={health.phoenix.enabled ? 'info' : 'default'}>
                      Phoenix {health.phoenix.enabled ? 'on' : 'off'}
                    </Badge>
                  ) : null}
                </>
              ) : null}
            </div>

            <div>
              <label htmlFor="obs-conversation" className={`text-xs font-medium ${TEXT.tertiary}`}>
                Conversation
              </label>
              {singleConversation ? (
                <p className={`mt-1 text-sm ${TEXT.primary}`}>
                  {conversationOptions[0].title}
                  {conversationOptions[0].turnCount != null
                    ? ` (${conversationOptions[0].turnCount} turns)`
                    : ''}
                </p>
              ) : (
                <select
                  id="obs-conversation"
                  value={conversationId}
                  onChange={(e) => setConversationId(e.target.value)}
                  disabled={!monitorEnabled || analyzing}
                  className="mt-1 w-full max-w-md rounded-xl border border-[#d2d2d7]/80 bg-white px-3 py-2 text-sm text-[#1d1d1f]"
                >
                  {conversationOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.turnCount != null ? ` (${c.turnCount} turns)` : ''}
                    </option>
                  ))}
                </select>
              )}
              {analyzing ? (
                <p className={`text-xs mt-1 ${TEXT.muted}`}>Loading session analytics…</p>
              ) : null}
              {bootstrap.conversationsHint && !singleConversation ? (
                <p className={`text-xs mt-1 ${TEXT.muted}`}>{bootstrap.conversationsHint}</p>
              ) : null}
            </div>
          </div>

          {analyzeData?.errors && analyzeData.errors.length > 0 ? (
            <Alert variant="warning">
              <p className="text-sm font-medium">Some Site Monitor data could not be loaded:</p>
              <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                {analyzeData.errors.map((e) => (
                  <li key={`${e.source}-${e.status}`}>
                    <span className="font-medium capitalize">{e.source}</span>: {e.message}
                    {e.source === 'context' && /timed out/i.test(e.message)
                      ? ' — coaching hints may still load on retry; dashboard and intent data above may be partial.'
                      : null}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {analyzed && summaryCards.length > 0 ? (
            <ObservabilityStatCards cards={summaryCards} />
          ) : analyzed ? (
            <Alert variant="info">No session summary cards returned for this conversation.</Alert>
          ) : null}

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <ObservabilityIntentProfilePanel
                monitorEnabled={monitorEnabled}
                intentProfile={analyzeData?.intentProfile}
                analyzed={analyzed}
                analyzing={analyzing}
              />
            </div>
            <div className="lg:col-span-7">
              <ObservabilityLiveContextPanel
                monitorEnabled={monitorEnabled}
                liveContext={analyzeData?.coachingContext ?? null}
                analyzed={analyzed}
                analyzing={analyzing}
              />
            </div>
          </div>

          {analyzed && dev ? (
            <>
              <ObservabilityExecutivePanel executiveKpis={dev.executiveKpis} />
              <div className="grid lg:grid-cols-2 gap-4">
                <ObservabilityLearningPanel learningMetrics={dev.learningMetrics} />
                <ObservabilityChartsPanel charts={dev.charts} />
              </div>
              <ObservabilityTurnTable
                projectId={projectId}
                conversationId={analyzeData?.conversationId ?? conversationId}
                turns={dev.turns}
                analyzed={analyzed}
              />
              <ObservabilityImprovementBriefPanel
                brief={dev.improvementBrief}
                sections={dev.improvementBriefSections}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
