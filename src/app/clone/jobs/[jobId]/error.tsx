'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ACCENT, TEXT } from '@/content/productTheme';

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
      <h2 className={`text-lg font-semibold mb-2 ${TEXT.primary}`}>Clone job failed to load</h2>
      <p className={`text-sm max-w-md mb-4 ${TEXT.muted}`}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
      <Link href="/dashboard" className={`mt-4 text-sm ${ACCENT.link} hover:underline`}>
        ← Back to dashboard
      </Link>
    </div>
  );
}
