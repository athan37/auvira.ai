'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface Props {
  jobId: string;
  onDeployStart: () => void;
}

export default function DeployPreviewButton({ jobId, onDeployStart }: Props) {
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (deploying) return;
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/clone/jobs/${jobId}/deploy-preview`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        onDeployStart();
      } else {
        setError(data.error || 'Deployment failed');
        setDeploying(false);
      }
    } catch {
      setError('Network error');
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full"
        size="lg"
      >
        {deploying ? 'Starting deployment...' : 'Deploy Website'}
      </Button>
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
      <p className={cn('text-xs text-center', TEXT.tertiary)}>
        Publishes to Vercel. Save to GitLab first if you want to return later without deploying yet.
      </p>
    </div>
  );
}
