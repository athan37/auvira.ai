import { promises as fs } from 'fs';
import path from 'path';
import { createPatch } from 'diff';
import type { IProjectEditJob } from '@/models/ProjectEditJob';
import { resolveSafePath } from './workspaceEditShared';

const MAX_DIFF_LINES = 500;

export interface EditJobFileRevision {
  before: string | null;
  after: string | null;
  /** True when after is read from live workspace (may differ if user edited again). */
  afterMayBeStale: boolean;
}

export interface EditJobFileDiffResult {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  patch: string;
  beforeLineCount: number;
  afterLineCount: number;
  truncated: boolean;
  afterMayBeStale: boolean;
}

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Read pre-edit (snapshot) and post-edit (workspace) contents for a changed file. */
export async function readEditJobFileRevision(
  job: Pick<IProjectEditJob, 'snapshotPath' | 'workspacePath' | 'changedFiles'>,
  relPath: string
): Promise<EditJobFileRevision> {
  const normalized = normalizeRelPath(relPath);
  const listed = job.changedFiles.some((f) => normalizeRelPath(f.path) === normalized);
  if (!listed) {
    throw new Error('File was not part of this edit job.');
  }

  const entry = job.changedFiles.find((f) => normalizeRelPath(f.path) === normalized);
  const status = entry?.status ?? 'modified';

  let before: string | null = null;
  if (job.snapshotPath && status !== 'added') {
    const beforePath = resolveSafePath(job.snapshotPath, normalized);
    if (beforePath) {
      try {
        before = await fs.readFile(beforePath, 'utf-8');
      } catch {
        before = null;
      }
    }
  }

  let after: string | null = null;
  if (job.workspacePath && status !== 'deleted') {
    const afterPath = resolveSafePath(job.workspacePath, normalized);
    if (afterPath) {
      try {
        after = await fs.readFile(afterPath, 'utf-8');
      } catch {
        after = null;
      }
    }
  }

  return {
    before: status === 'added' ? null : before,
    after: status === 'deleted' ? null : after,
    afterMayBeStale: Boolean(job.workspacePath),
  };
}

function truncateForDiff(content: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return { text: content, truncated: false };
  }
  return {
    text: [...lines.slice(0, maxLines), `… (${lines.length - maxLines} more lines truncated)`].join(
      '\n'
    ),
    truncated: true,
  };
}

/**
 * Build a unified diff patch for debugging (snapshot vs workspace).
 */
export function buildEditJobFilePatch(
  relPath: string,
  revision: EditJobFileRevision,
  status: 'added' | 'modified' | 'deleted'
): EditJobFileDiffResult {
  const normalized = normalizeRelPath(relPath);
  const beforeText = revision.before ?? '';
  const afterText = revision.after ?? '';

  const beforeSlice = truncateForDiff(beforeText, MAX_DIFF_LINES);
  const afterSlice = truncateForDiff(afterText, MAX_DIFF_LINES);
  const truncated = beforeSlice.truncated || afterSlice.truncated;

  let patch: string;
  if (status === 'added') {
    patch =
      createPatch(normalized, '', afterSlice.text, 'before', 'after', { context: 3 }) ||
      `+++ ${normalized}\n${afterSlice.text}`;
  } else if (status === 'deleted') {
    patch =
      createPatch(normalized, beforeSlice.text, '', 'before', 'after', { context: 3 }) ||
      `--- ${normalized}\n${beforeSlice.text}`;
  } else {
    patch =
      createPatch(normalized, beforeSlice.text, afterSlice.text, 'before', 'after', {
        context: 3,
      }) || '(no diff — contents match or could not be read)';
  }

  return {
    path: normalized,
    status,
    patch,
    beforeLineCount: beforeText ? beforeText.split('\n').length : 0,
    afterLineCount: afterText ? afterText.split('\n').length : 0,
    truncated,
    afterMayBeStale: revision.afterMayBeStale,
  };
}
