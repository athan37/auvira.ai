import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.venv',
  'snapshots',
]);

const SKIP_FILES = new Set(['.DS_Store']);

/**
 * Create a filesystem snapshot of a workspace directory for rollback.
 */
export async function createDirectorySnapshot(
  workspacePath: string,
  projectId: string
): Promise<string | null> {
  const resolvedWorkspace = path.resolve(workspacePath);
  const snapshotDir = scratchPath('edit-snapshots', projectId, Date.now().toString());

  try {
    await fs.mkdir(snapshotDir, { recursive: true });
    await copyDirectory(resolvedWorkspace, snapshotDir, resolvedWorkspace);
    return snapshotDir;
  } catch (err) {
    console.error('[snapshot] create failed:', err);
    return null;
  }
}

/**
 * Restore workspace files from a snapshot directory.
 */
export async function restoreDirectorySnapshot(
  workspacePath: string,
  snapshotPath: string
): Promise<boolean> {
  const resolvedWorkspace = path.resolve(workspacePath);
  const resolvedSnapshot = path.resolve(snapshotPath);

  if (!resolvedSnapshot.startsWith(scratchPath('edit-snapshots'))) {
    return false;
  }

  try {
    await clearWorkspaceContents(resolvedWorkspace);
    await copyDirectory(resolvedSnapshot, resolvedWorkspace, resolvedSnapshot);
    return true;
  } catch (err) {
    console.error('[snapshot] restore failed:', err);
    return false;
  }
}

async function clearWorkspaceContents(workspacePath: string): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(workspacePath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name === 'snapshots') continue;
    const fullPath = path.join(workspacePath, entry.name);
    await fs.rm(fullPath, { recursive: true, force: true });
  }
}

async function copyDirectory(
  srcDir: string,
  destDir: string,
  workspaceRoot: string
): Promise<void> {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || SKIP_FILES.has(entry.name)) continue;
    if (entry.name === 'snapshots' && srcDir === workspaceRoot) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath, workspaceRoot);
    } else if (entry.isFile()) {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }
  }
}
