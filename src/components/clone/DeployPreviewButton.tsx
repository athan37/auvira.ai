'use client';

import { useState } from 'react';

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
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full bg-green-600 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {deploying ? 'Starting deployment...' : 'Deploy Website'}
      </button>
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
      <p className="text-xs text-gray-400 text-center">
        Publishes to Vercel. Save to GitLab first if you want to return later without deploying yet.
      </p>
    </div>
  );
}