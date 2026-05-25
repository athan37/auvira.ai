import path from 'path';

/**
 * Directory containing the Node binary running this process (e.g. nvm Node 20).
 */
export function getNodeBinDir(): string {
  return path.dirname(process.execPath);
}

export function getNpmPath(): string {
  return path.join(getNodeBinDir(), 'npm');
}

export function getNodePath(): string {
  return process.execPath;
}
