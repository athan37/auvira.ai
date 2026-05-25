'use client';

import { useState } from 'react';
import Link from 'next/link';

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
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {isSaved ? 'Project saved' : 'Save your work'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSaved
              ? 'Committed to GitLab. Return anytime from your dashboard to edit and test.'
              : 'Commit to GitLab so you can leave and continue editing later — no Vercel deploy yet.'}
          </p>
        </div>
        {isSaved && (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Saved
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving
          ? 'Saving to GitLab...'
          : isSaved
            ? 'Save latest changes'
            : 'Save to GitLab'}
      </button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {isSaved && projectId && (
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={`/projects/${projectId}`}
            className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Open project workspace →
          </Link>
          {gitlabRepoUrl && (
            <a
              href={gitlabRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs text-gray-500 hover:text-indigo-600 hover:underline"
            >
              View on GitLab
            </a>
          )}
        </div>
      )}
    </div>
  );
}
