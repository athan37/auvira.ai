/** Maps stored edit-job errors to plain language for the Changes tab. */
export function formatEditJobError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null;

  const lower = error.toLowerCase();
  if (lower.includes('controller is already closed') || lower.includes('invalid state')) {
    return 'The edit connection closed before the agent finished. Your preview may still show the changes.';
  }
  if (lower.includes('force sync')) {
    return error;
  }
  return error;
}

export function editStatusLabel(
  status: string | null,
  changedFileCount: number
): string {
  if (!status) return '—';
  if (status === 'failed' && changedFileCount > 0) return 'incomplete';
  return status;
}
