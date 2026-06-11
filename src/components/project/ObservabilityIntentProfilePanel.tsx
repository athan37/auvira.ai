'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';
import {
  keywordInterestClassName,
  renderIntentProfile,
} from '@/lib/observability/keywordWordCloud';
import type { MonitorIntentProfileView } from '@/lib/observability/parseIntentProfile';

/** Group 2 — Site Monitor GET /intent profile (tracked intent + keyword cloud). */
export function ObservabilityIntentProfilePanel({
  monitorEnabled,
  intentProfile,
  analyzed,
}: {
  monitorEnabled: boolean;
  intentProfile?: MonitorIntentProfileView | null;
  analyzed?: boolean;
}) {
  const profile = renderIntentProfile(intentProfile);

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Tracked intent profile</h2>
        <p className={`text-xs mt-0.5 ${TEXT.muted}`}>
          Owner keywords and classified edit types from Mongo turn history
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!monitorEnabled ? (
          <EmptyState
            title="Monitor not configured"
            description="Enable Site Monitor to load project intent attributes."
            className="py-6"
          />
        ) : !analyzed ? (
          <EmptyState
            title="Not analyzed yet"
            description="Select a conversation and click Analyze session."
            className="py-6"
          />
        ) : !profile ? (
          <EmptyState
            title="No intent profile"
            description="No turn history yet. POST /turns first."
            className="py-6"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone="default">
                Turns: <span className="font-medium">{profile.turnCount}</span>
              </Badge>
              {profile.scope ? (
                <Badge tone="info">
                  Scope: <span className="font-medium">{profile.scope}</span>
                </Badge>
              ) : null}
              {profile.updatedAt ? (
                <Badge tone="default">
                  Updated:{' '}
                  <span className="font-medium">
                    {new Date(profile.updatedAt).toLocaleString()}
                  </span>
                </Badge>
              ) : null}
            </div>

            {profile.cloudItems.length > 0 ? (
              <div
                id="keywordCloud"
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 min-h-[140px] px-2 py-4"
                role="img"
                aria-label={`Keyword cloud: ${profile.cloudItems.map((k) => k.display).join(', ')}`}
              >
                {profile.cloudItems.map((item) => (
                  <span
                    key={item.raw}
                    className={cn(
                      'inline-block font-semibold leading-tight tracking-tight',
                      keywordInterestClassName(item.interestClass)
                    )}
                    data-kw-class={item.interestClass}
                    style={{ fontSize: `${item.fontSizeRem}rem` }}
                    title={item.raw}
                  >
                    {item.display}
                  </span>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${TEXT.muted}`}>
                No keywords yet — record turns with POST /turns.
              </p>
            )}

            {profile.intents.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Classified edit types
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {profile.intents.map((intent) => (
                    <li key={intent}>
                      <Badge tone="info">{intent}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
