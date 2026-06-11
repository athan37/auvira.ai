'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import type { MonitorImprovementBriefSection } from '@/lib/observability/parseMonitorDashboard';

/** Group 9 — session narrative from improvement_brief. */
export function ObservabilityImprovementBriefPanel({
  brief,
  sections,
}: {
  brief?: string;
  sections?: MonitorImprovementBriefSection[];
}) {
  if (!brief?.trim()) {
    return (
      <Card variant="glass">
        <CardHeader className="border-[#d2d2d7]/80">
          <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Session narrative</h2>
        </CardHeader>
        <CardBody>
          <EmptyState
            title="No improvement brief"
            description="Site Monitor will include a narrative when enough session data is available."
            className="py-6"
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Session narrative</h2>
      </CardHeader>
      <CardBody>
        {sections && sections.length > 0 ? (
          <ol className="space-y-4">
            {sections.map((section, i) => (
              <li key={`${i}-${section.title}`}>
                <h3 className={`text-sm font-semibold ${TEXT.primary}`}>{section.title}</h3>
                <p className={`text-sm mt-1 leading-relaxed ${TEXT.muted}`}>{section.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={`text-sm leading-relaxed ${TEXT.muted}`}>{brief}</p>
        )}
      </CardBody>
    </Card>
  );
}
