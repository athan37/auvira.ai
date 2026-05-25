'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Props {
  liveUrl?: string | null;
  projectId: string;
  onContinue?: () => void;
}

/** Post-deploy interstitial before redirecting to the project editor. */
export function CloneDeployInterstitial({ liveUrl, projectId, onContinue }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onContinue?.();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onContinue]);

  return (
    <Card className="p-6 mb-4 border-emerald-200 bg-emerald-50/60">
      <h2 className="text-lg font-semibold text-emerald-900">Your site is live!</h2>
      <p className="text-sm text-emerald-800 mt-1">
        {liveUrl
          ? `Visitors can reach it at ${liveUrl.replace(/^https?:\/\//, '')}.`
          : 'Your live website is ready.'}
      </p>
      <p className="text-xs text-emerald-700 mt-2">
        Opening the editor in {secondsLeft}s to make more changes…
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">Open live site</Button>
          </a>
        )}
        <Link href={`/projects/${projectId}`}>
          <Button>Open editor now</Button>
        </Link>
      </div>
    </Card>
  );
}
