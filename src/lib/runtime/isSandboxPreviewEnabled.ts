import { isVercelServerless } from '@/lib/runtime/isVercelServerless';

/** True when Vercel serverless should use Vercel Sandbox for preview + edits. */
export function isSandboxPreviewEnabled(): boolean {
  if (!isVercelServerless()) return false;
  if (process.env.SITE_AGENT_SANDBOX_ENABLED === '0') return false;
  return true;
}
