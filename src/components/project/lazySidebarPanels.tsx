'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';

export const LazyChangedFilesPanel = dynamic(
  () =>
    import('@/components/project/ChangedFilesPanel').then((m) => ({
      default: m.ChangedFilesPanel,
    })),
  { loading: () => <PanelLoader label="Loading changes…" /> }
);

export const LazyPublishedStatusCard = dynamic(
  () =>
    import('@/components/PublishedStatusCard').then((m) => ({
      default: m.PublishedStatusCard,
    })),
  { loading: () => <PanelLoader label="Loading publish status…" /> }
);

export const LazySaveDeployActions = dynamic(
  () =>
    import('@/components/SaveDeployActions').then((m) => ({ default: m.SaveDeployActions })),
  { loading: () => <PanelLoader label="Loading deploy actions…" /> }
);

export const LazyBusinessWatchCard = dynamic(
  () =>
    import('@/components/site-manager/BusinessWatchCard').then((m) => ({
      default: m.BusinessWatchCard,
    })),
  { loading: () => <PanelLoader label="Loading watch…" /> }
);

function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
      <Spinner size="sm" />
      {label}
    </div>
  );
}
