/** Plain-English labels for owner-facing UI (avoid GitLab/Vercel/commit jargon). */

export function ownerProjectStatusLabel(status?: string, deploymentStatus?: string): string {
  if (deploymentStatus === 'building' || deploymentStatus === 'pending' || deploymentStatus === 'triggered') {
    return 'Updating live site…';
  }
  if (deploymentStatus === 'ready') return 'Live';
  if (deploymentStatus === 'failed') return 'Publish failed';
  switch (status) {
    case 'ready':
    case 'active':
      return 'Ready to edit';
    case 'building':
      return 'Setting up…';
    case 'failed':
      return 'Needs attention';
    default:
      return status?.replace(/_/g, ' ') || 'Draft';
  }
}

export function ownerDeploymentBadgeLabel(
  status?: string,
  commitVerified?: boolean
): string {
  if (status === 'ready' && commitVerified) return 'Live website';
  if (status === 'building' || status === 'pending' || status === 'triggered') {
    return 'Updating live site…';
  }
  if (status === 'ready') return 'Verifying live site…';
  if (status === 'failed') return 'Publish failed';
  return 'Not published yet';
}

export const OWNER_COPY = {
  draftPreview: 'Your draft preview',
  liveWebsite: 'Live website',
  backupCopy: 'Save backup copy',
  backupCopyHint: 'Keeps a safe copy of your draft so you can come back later.',
  publishLive: 'Publish live site',
  publishLiveHint:
    'Publishes your draft preview to your live website address. This is what visitors see.',
  unsavedDraft: 'Unpublished edits',
  noUnsaved: 'Draft matches your last backup.',
  publishConfirm:
    'Publish your latest draft to your live website? We save a backup first, then update your live site.',
} as const;
