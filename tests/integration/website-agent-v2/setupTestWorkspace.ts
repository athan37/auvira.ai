import { cp, rm } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { LocalFsGateway } from '@/lib/project-workspace/workspaceGateway';

const FIXTURE_NAME = 'website-agent-v2-section-loop';

export interface TestWorkspaceHandle {
  workspacePath: string;
  gateway: LocalFsGateway;
  readRel: (relPath: string) => Promise<string>;
  cleanup: () => Promise<void>;
}

/**
 * Copy the V2 section-loop fixture into a scratch workspace for isolated tests.
 */
export async function setupTestWorkspace(): Promise<TestWorkspaceHandle> {
  const id = randomUUID().slice(0, 8);
  const scratchId = `v2-test-${id}`;
  const workspacePath = scratchPath('project-workspaces', scratchId, 'workspace');
  const fixturePath = path.join(
    process.cwd(),
    'tests',
    'fixtures',
    'workspaces',
    FIXTURE_NAME
  );

  await cp(fixturePath, workspacePath, { recursive: true });
  const gateway = new LocalFsGateway(workspacePath);

  return {
    workspacePath,
    gateway,
    readRel: (relPath) => gateway.readFile(relPath),
    cleanup: async () => {
      await rm(scratchPath('project-workspaces', scratchId), {
        recursive: true,
        force: true,
      });
    },
  };
}
