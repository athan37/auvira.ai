'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ACCENT, TEXT } from '@/content/productTheme';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[project-editor]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
      <h2 className={`text-lg font-semibold mb-2 ${TEXT.primary}`}>Something went wrong</h2>
      <p className={`text-sm max-w-md mb-4 ${TEXT.muted}`}>
        The project editor hit an unexpected error. You can try again or return to the dashboard.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
          Dashboard
        </Button>
      </div>
      <Link href="/dashboard" className={`mt-4 text-sm ${ACCENT.link} hover:underline`}>
        ← Back to dashboard
      </Link>
    </div>
  );
}
