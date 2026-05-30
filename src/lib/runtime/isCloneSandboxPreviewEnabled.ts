import { isVercelServerless } from '@/lib/runtime/isVercelServerless';

/** True when clone preview build should bootstrap an ephemeral Vercel Sandbox. */
export function isCloneSandboxPreviewEnabled(): boolean {
  if (!isVercelServerless()) return false;
  if (process.env.SITE_AGENT_SANDBOX_ENABLED === '0') return false;
  return process.env.SITE_AGENT_SANDBOX_CLONE_PREVIEW === '1';
}
