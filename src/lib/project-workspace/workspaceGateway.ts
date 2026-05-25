export interface WorkspaceGateway {
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, content: string): Promise<void>;
  searchFiles(pattern: string): Promise<string[]>;
  searchCode(
    query: string,
    fileGlob?: string
  ): Promise<Array<{ path: string; line: number; content: string }>>;
  applyPatch(patch: string): Promise<{ ok: boolean; error?: string }>;
  computeHashes(): Promise<Record<string, string>>;
  getWorkspacePath(): string;
  isSandbox(): boolean;
}

export { LocalFsGateway } from './localFsGateway';
