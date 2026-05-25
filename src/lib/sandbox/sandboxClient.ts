import { Sandbox } from '@vercel/sandbox';
import { sandboxNameForProject } from './sandboxNames';

const sandboxInstances = new Map<string, Sandbox>();

/** Parse duration strings like `30m`, `1h`, `900000` (ms). Default 30 minutes. */
export function parseSandboxTimeout(value?: string): number {
  const raw = (value || '30m').trim();
  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(raw);
  if (!match) return 30 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = (match[2] || (n >= 1000 ? 'ms' : 'm')).toLowerCase();
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 60 * 60 * 1000;
    case 'd':
      return n * 24 * 60 * 60 * 1000;
    default:
      return 30 * 60 * 1000;
  }
}

/** Build HTTPS clone URL with oauth2 token (never log the result). */
export function buildAuthenticatedGitLabCloneUrl(httpUrlToRepo: string): string {
  const token = process.env.GITLAB_TOKEN?.trim();
  if (!token) {
    throw new Error('GITLAB_TOKEN is required for sandbox clone');
  }
  const url = new URL(httpUrlToRepo);
  url.username = 'oauth2';
  url.password = token;
  return url.toString();
}

export function cacheSandbox(projectId: string, sandbox: Sandbox): void {
  sandboxInstances.set(projectId, sandbox);
}

export function getCachedSandbox(projectId: string): Sandbox | undefined {
  return sandboxInstances.get(projectId);
}

export function clearCachedSandbox(projectId: string): void {
  sandboxInstances.delete(projectId);
}

/** Retrieve a named sandbox (resume session). */
export async function getProjectSandbox(projectId: string): Promise<Sandbox> {
  const cached = getCachedSandbox(projectId);
  if (cached) return cached;

  const name = sandboxNameForProject(projectId);
  const sandbox = await Sandbox.get({ name });
  cacheSandbox(projectId, sandbox);
  return sandbox;
}

export function defaultSandboxTimeoutMs(): number {
  return parseSandboxTimeout(process.env.SITE_AGENT_SANDBOX_TIMEOUT);
}

export function sandboxNameForProjectId(projectId: string): string {
  return sandboxNameForProject(projectId);
}
