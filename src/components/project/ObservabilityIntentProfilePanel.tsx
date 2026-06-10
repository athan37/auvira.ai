'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import {
  isIntentProfileHighlightKeyword,
  type MonitorIntentProfileView,
} from '@/lib/observability/parseIntentProfile';

/** Site Monitor GET /intent — project-level keywords and classified edit types. */
export function ObservabilityIntentProfilePanel({
  monitorEnabled,
  intentProfile,
}: {
  monitorEnabled: boolean;
  intentProfile?: MonitorIntentProfileView | null;
}) {
  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Tracked intent profile</h2>
        <p className={`text-xs mt-0.5 ${TEXT.muted}`}>
          Extracted from Site Monitor turn history (Phoenix traces)
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!monitorEnabled ? (
          <EmptyState
            title="Monitor not configured"
            description="Enable Site Monitor to load project intent attributes."
            className="py-6"
          />
        ) : !intentProfile ? (
          <EmptyState
            title="No intent profile yet"
            description="Record a few edits and rebuild the profile on Site Monitor."
            className="py-6"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-[#6e6e73]">
              <span>
                Turns analyzed:{' '}
                <span className={`font-medium ${TEXT.primary}`}>{intentProfile.turnCount}</span>
              </span>
              {intentProfile.scope ? (
                <span>
                  Scope: <span className={`font-medium ${TEXT.primary}`}>{intentProfile.scope}</span>
                </span>
              ) : null}
            </div>
            {intentProfile.intents.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Classified edit types
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {intentProfile.intents.map((intent) => (
                    <li key={intent}>
                      <Badge tone="info">{intent}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {intentProfile.keywords.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Owner keywords
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {intentProfile.keywords.map((keyword) => (
                    <li key={keyword}>
                      <Badge
                        tone={isIntentProfileHighlightKeyword(keyword) ? 'warning' : 'default'}
                        className="capitalize"
                      >
                        {keyword}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className={`text-[11px] mt-2 ${TEXT.muted}`}>
                  Highlighted terms like favorite and color are what Monitor uses for implicit
                  references (e.g. &quot;my favorite color&quot;).
                </p>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
