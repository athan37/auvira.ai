import os from 'os';
import path from 'path';

const SCRATCH_FOLDER = 'site-agent';

/**
 * Writable scratch root. Local dev uses project/.tmp; Vercel/Lambda use /tmp (read-only /var/task).
 */
export function getScratchRoot(): string {
  const override = process.env.SITE_AGENT_SCRATCH_DIR?.trim();
  if (override) return override;

  if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), SCRATCH_FOLDER);
  }

  return path.join(process.cwd(), '.tmp');
}

export function scratchPath(...segments: string[]): string {
  return path.join(getScratchRoot(), ...segments);
}
