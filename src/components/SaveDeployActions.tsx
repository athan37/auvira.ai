'use client';

import { PublishActions } from '@/components/owner/PublishActions';

interface Props {
  projectId: string;
  needsSave?: boolean;
  hasGitlab?: boolean;
  deploymentStatus?: string;
  onSaveSuccess?: () => void;
  onDeploySuccess?: () => void;
  compact?: boolean;
}

/** Editor save/deploy — delegates to unified owner publish UI. */
export function SaveDeployActions({
  projectId,
  needsSave,
  hasGitlab,
  deploymentStatus,
  onSaveSuccess,
  onDeploySuccess,
  compact,
}: Props) {
  return (
    <PublishActions
      mode="editor"
      targetId={projectId}
      needsSave={needsSave}
      hasGitlab={hasGitlab}
      deploymentStatus={deploymentStatus}
      onSaveSuccess={onSaveSuccess}
      onDeploySuccess={onDeploySuccess}
      compact={compact}
    />
  );
}
