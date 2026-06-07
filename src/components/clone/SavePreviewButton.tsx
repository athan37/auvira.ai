'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ACCENT, BORDER, RADIUS, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface Props {
  jobId: string;
  createdProjectId?: string;
  gitlabRepoUrl?: string | null;
  onSaved: () => void;
}

export default function SavePreviewButton({
  jobId,
  createdProjectId,
  gitlabRepoUrl,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedProjectId, setLastSavedProjectId] = useState<string | null>(null);

  const projectId = createdProjectId || lastSavedProjectId;
  const isSaved = Boolean(projectId);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/clone/jobs/${jobId}/save-preview`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setLastSavedProjectId(data.projectId);
        onSaved();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('space-y-2 border bg-white p-4', RADIUS.card, BORDER.hairline)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={cn('text-sm font-semibold', TEXT.primary)}>
            {isSaved ? 'Project saved' : 'Save your work'}
          </h3>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>
            {isSaved
              ? 'Committed to GitLab. Return anytime from your dashboard to edit and test.'
              : 'Commit to GitLab so you can leave and continue editing later — no Vercel deploy yet.'}
          </p>
        </div>
        {isSaved && <Badge tone="success">Saved</Badge>}
      </div>

      <Button
        type="button"
        variant="primary"
        onClick={handleSave}
        disabled={saving}
        className="w-full"
        size="lg"
      >
        {saving
          ? 'Saving to GitLab...'
          : isSaved
            ? 'Save latest changes'
            : 'Save to GitLab'}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {isSaved && projectId && (
        <div className="flex flex-col gap-2 pt-1">
          <Link href={`/projects/${projectId}`}>
            <Button variant="glass" className="w-full">
              Open project workspace →
            </Button>
          </Link>
          {gitlabRepoUrl && (
            <a
              href={gitlabRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('text-center text-xs hover:underline', TEXT.muted, ACCENT.link)}
            >
              View on GitLab
            </a>
          )}
        </div>
      )}
    </div>
  );
}
