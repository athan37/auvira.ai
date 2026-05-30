'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function CloneJobError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[clone-job]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Clone job failed to load</h2>
      <p className="text-sm text-zinc-600 max-w-md mb-4">{error.message || 'An unexpected error occurred.'}</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
