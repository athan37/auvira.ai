/** Default working directory inside a Vercel Sandbox VM (SDK default for relative paths). */
export const SANDBOX_WORKDIR = '/vercel/sandbox';

export interface SandboxBootstrapResult {
  previewUrl: string;
  sandboxName: string;
  workspacePath: string;
}
