/** True when running on Vercel serverless (no long-lived preview dev server). */
export function isVercelServerless(): boolean {
  return process.env.VERCEL === '1';
}
