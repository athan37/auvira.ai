'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

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
    <Card variant="glass" className="p-6 mb-4 border-emerald-200/80 bg-emerald-50/40">
      <div className="flex items-center gap-2 mb-1">
        <h2 className={cn('text-lg font-semibold', TEXT.primary)}>Your site is live!</h2>
        <Badge tone="success">Deployed</Badge>
      </div>
      <p className={cn('text-sm mt-1', TEXT.muted)}>
        {liveUrl
          ? `Visitors can reach it at ${liveUrl.replace(/^https?:\/\//, '')}.`
          : 'Your live website is ready.'}
      </p>
      <p className={cn('text-xs mt-2 text-emerald-800')}>
        Opening the editor in {secondsLeft}s to make more changes…
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="glass">Open live site</Button>
          </a>
        )}
        <Link href={`/projects/${projectId}`}>
          <Button variant="primary">Open editor now</Button>
        </Link>
      </div>
    </Card>
  );
}
