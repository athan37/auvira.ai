import { promises as fs } from 'fs';
import path from 'path';
import type { IChangedFile, ChangedFileStatus } from '@/models/ProjectEditJob';

export function getChangedPathsFromHashes(
  beforeHashes: Record<string, string>,
  afterHashes: Record<string, string>
): string[] {
  const changed: string[] = [];
  for (const [fn, hash] of Object.entries(afterHashes)) {
    if (!beforeHashes[fn] || beforeHashes[fn] !== hash) {
      changed.push(fn);
    }
  }
  for (const fn of Object.keys(beforeHashes)) {
    if (!afterHashes[fn]) changed.push(fn);
  }
  return [...new Set(changed)];
}

async function readFileLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

export async function buildChangedFileDetails(
  workspacePath: string,
  beforeHashes: Record<string, string>,
  afterHashes: Record<string, string>,
  snapshotPath?: string | null,
  options?: { readRelFile?: (relPath: string) => Promise<string | null> }
): Promise<IChangedFile[]> {
  const paths = getChangedPathsFromHashes(beforeHashes, afterHashes);
  const result: IChangedFile[] = [];

  for (const relPath of paths) {
    const hadBefore = Boolean(beforeHashes[relPath]);
    const hasAfter = Boolean(afterHashes[relPath]);

    let status: ChangedFileStatus = 'modified';
    if (!hadBefore && hasAfter) status = 'added';
    else if (hadBefore && !hasAfter) status = 'deleted';

    let additions = 0;
    let deletions = 0;

    const afterFile = hasAfter ? path.join(workspacePath, relPath) : null;
    const beforeFile = snapshotPath
      ? path.join(snapshotPath, relPath)
      : hadBefore
        ? path.join(workspacePath, relPath)
        : null;

    const readRel = options?.readRelFile;
    if (status === 'added' && (afterFile || readRel)) {
      additions = readRel && hasAfter
        ? (await readRel(relPath))?.split('\n').length || 0
        : afterFile
          ? await readFileLines(afterFile)
          : 0;
    } else if (status === 'deleted' && (beforeFile || readRel)) {
      deletions = snapshotPath && beforeFile
        ? await readFileLines(beforeFile)
        : 0;
    } else if (status === 'modified' && (afterFile || readRel)) {
      const beforeLines =
        snapshotPath && beforeFile
          ? await readFileLines(beforeFile)
          : 0;
      const afterLines = readRel
        ? (await readRel(relPath))?.split('\n').length || 0
        : afterFile
          ? await readFileLines(afterFile)
          : 0;
      if (afterLines >= beforeLines) additions = afterLines - beforeLines;
      else deletions = beforeLines - afterLines;
    }

    result.push({ path: relPath, status, additions, deletions });
  }

  return result;
}
