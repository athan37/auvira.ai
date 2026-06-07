'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Alert } from '@/components/ui/Alert';
import { SITE_MANAGER_COPY } from '@/lib/owner/ownerCopy';
import { BusinessProfileEditor, type BusinessProfileFormData } from './BusinessProfileEditor';
import { WatchRuleToggleList, type WatchMonitorItem } from './WatchRuleToggleList';
import { SiteIncidentCard } from './SiteIncidentCard';
import { SiteManagerStatusBadge } from './SiteManagerStatusBadge';
import { TEXT } from '@/content/productTheme';

type WatchStatus = 'healthy' | 'setup' | 'issue' | 'fixing' | 'fixed';

interface Props {
  projectId: string;
  onRefresh?: () => void;
}

export function BusinessWatchCard({ projectId, onRefresh }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/business-watch`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardBody className="flex justify-center py-8">
          <Loading size="sm" />
        </CardBody>
      </Card>
    );
  }

  const copy = data?.copy as { headline?: string; body?: string; status?: WatchStatus } | undefined;
  const status: WatchStatus = fixing ? 'fixing' : (copy?.status ?? 'setup');

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <span className="font-semibold">{SITE_MANAGER_COPY.businessWatchTitle}</span>
        <SiteManagerStatusBadge status={status} />
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {data?.needsSetup ? (
          <BusinessProfileEditor
            initial={(data.profile as BusinessProfileFormData) ?? {}}
            onSave={async (form) => {
              setBusy(true);
              await fetch(`/api/projects/${projectId}/business-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
              });
              await load();
              setBusy(false);
            }}
            onConfirm={async (form) => {
              setBusy(true);
              const res = await fetch(`/api/projects/${projectId}/business-profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, confirm: true }),
              });
              const json = await res.json();
              if (!json.ok) setError(json.error || 'Confirm failed');
              await load();
              onRefresh?.();
              setBusy(false);
            }}
            saving={busy}
          />
        ) : (
          <>
            {copy && !data?.incident && (
              <div>
                <p className="text-sm font-medium">{copy.headline}</p>
                <p className={cn('text-sm mt-1', TEXT.muted)}>{copy.body}</p>
              </div>
            )}

            {data?.incident && data?.proposal && (
              <SiteIncidentCard
                headline={copy?.headline ?? SITE_MANAGER_COPY.businessWatchTitle}
                body={copy?.body ?? ''}
                proposalTitle={(data.proposal as { title: string }).title}
                proposalSummary={(data.proposal as { plainEnglishSummary: string }).plainEnglishSummary}
                fixing={fixing}
                onApplyFix={async () => {
                  setFixing(true);
                  const inc = data.incident as { id: string };
                  const res = await fetch(
                    `/api/projects/${projectId}/site-manager/incidents/${inc.id}/approve-fix`,
                    { method: 'POST' }
                  );
                  const json = await res.json();
                  if (!json.ok && !json.result?.ok) setError(json.result?.message || json.error || 'Fix failed');
                  await load();
                  onRefresh?.();
                  setFixing(false);
                }}
                onDismiss={async () => {
                  setBusy(true);
                  const inc = data.incident as { id: string };
                  await fetch(`/api/projects/${projectId}/site-manager/incidents/${inc.id}/dismiss`, {
                    method: 'POST',
                  });
                  await load();
                  setBusy(false);
                }}
              />
            )}

            <WatchRuleToggleList
              monitors={(data?.monitors as WatchMonitorItem[]) ?? []}
              disabled={busy || fixing}
              onToggle={async (id, enabled) => {
                setBusy(true);
                await fetch(`/api/projects/${projectId}/business-watch/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled }),
                });
                await load();
                setBusy(false);
              }}
            />

            <Button type="button" variant="secondary" size="sm" disabled={busy || fixing} onClick={async () => {
              setBusy(true);
              await fetch(`/api/projects/${projectId}/site-manager/run-checks`, { method: 'POST' });
              await load();
              setBusy(false);
            }}>
              {busy ? 'Checking…' : SITE_MANAGER_COPY.runCheckNow}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
