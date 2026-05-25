'use client';

import { Badge } from '@/components/ui/Badge';

interface Props {
  status: 'healthy' | 'setup' | 'issue' | 'fixing' | 'fixed';
}

const LABELS: Record<Props['status'], string> = {
  healthy: 'All good',
  setup: 'Setup',
  issue: 'Needs attention',
  fixing: 'Updating…',
  fixed: 'Fixed',
};

export function SiteManagerStatusBadge({ status }: Props) {
  const tone =
    status === 'healthy' || status === 'fixed'
      ? 'success'
      : status === 'issue'
        ? 'warning'
        : 'info';
  return <Badge tone={tone}>{LABELS[status]}</Badge>;
}
