/**
 * Cline CLI runner for owner website editing (optional — set WEBSITE_EDIT_AGENT=cline).
 *
 * Executes Cline inside a workspace path with a strict owner-facing prompt.
 * Never commits, pushes, or deploys.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { tryLlmWorkspaceEdit } from './llmWorkspaceEditFallback';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isAllowedWorkspacePath,
  isBlockedWorkspacePath,
} from './workspaceEditShared';

const USE_CLINE_AGENT = process.env.USE_CLINE_AGENT === 'true';
const USE_ADK_FALLBACK = process.env.USE_ADK_FALLBACK === 'true';
const CLINE_MODEL = process.env.CLINE_MODEL || 'minimax';
const CLINE_PROVIDER = process.env.CLINE_PROVIDER || 'openai-compatible';
const CLINE_OPENAI_API_BASE = process.env.CLINE_OPENAI_API_BASE || 'http://localhost:3457/v1';
const CLINE_OPENAI_API_KEY = process.env.CLINE_OPENAI_API_KEY || 'dummy';
const CLINE_TIMEOUT_SEC = parseInt(process.env.CLINE_TIMEOUT_SEC || '120', 10);
const ADK_CODING_AGENT_URL = process.env.ADK_CODING_AGENT_URL || 'http://localhost:8001';
const CLINE_BINARY_PATH =
  process.env.CLINE_BINARY_PATH ||
  path.join(process.cwd(), 'node_modules/@cline/cli-darwin-arm64/bin/cline');

let clineAuthPromise: Promise<void> | null = null;

function clineModelId(): string {
  return CLINE_MODEL.replace(/^openai\//, '');
}

/** Configure Cline CLI to use the local OpenAI-compatible proxy (chat API, not Responses API). */
function ensureClineAuth(): Promise<void> {
  if (!USE_CLINE_AGENT) return Promise.resolve();
  if (clineAuthPromise) return clineAuthPromise;

  clineAuthPromise = new Promise((resolve, reject) => {
    const child = spawn(
      CLINE_BINARY_PATH,
      [
        'auth',
        '--provider',
        CLINE_PROVIDER,
        '--apikey',
        CLINE_OPENAI_API_KEY,
        '--modelid',
        clineModelId(),
        '--baseurl',
        CLINE_OPENAI_API_BASE,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `cline auth failed with code ${code}`));
    });
    child.on('error', reject);
  });

  return clineAuthPromise;
}

async function runClineCli(
  workspacePath: string,
  systemPrompt: string,
  ownerMessage: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  await ensureClineAuth();

  const args = [
    '-c',
    workspacePath,
    '-P',
    CLINE_PROVIDER,
    '-k',
    CLINE_OPENAI_API_KEY,
    '-m',
    clineModelId(),
    '--auto-approve',
    'true',
    '-t',
    String(CLINE_TIMEOUT_SEC),
    '-s',
    systemPrompt,
    ownerMessage,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(CLINE_BINARY_PATH, args, {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Cline timed out after ${CLINE_TIMEOUT_SEC} seconds`));
    }, CLINE_TIMEOUT_SEC * 1000 + 5000);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export interface ClineEditResult {
  ok: boolean;
  summary?: string;
  rawOutput?: string;
  error?: string;
  changedFiles?: string[];
}

export interface ClineRunnerOptions {
  workspacePath: string;
  ownerMessage: string;
  projectId: string;
  mode: 'gitlab' | 'static';
}

/**
 * Run Cline to edit the website workspace.
 *
 * Returns {ok, summary, changedFiles} on success.
 * Returns {ok: false, error} on failure.
 *
 * Never commits, pushes, or deploys.
 */
export async function runClineWebsiteEdit(
  options: ClineRunnerOptions
): Promise<ClineEditResult> {
  const { workspacePath, ownerMessage, projectId, mode } = options;

  if (!isAllowedWorkspacePath(workspacePath)) {
    return {
      ok: false,
      error: 'Workspace path is not in an allowed directory.',
    };
  }

  try {
    const stat = await fs.stat(workspacePath);
    if (!stat.isDirectory()) {
      return { ok: false, error: 'Workspace path is not a directory.' };
    }
  } catch {
    return { ok: false, error: 'Workspace does not exist.' };
  }

  const useCline = USE_CLINE_AGENT;
  const useAdkFallback = USE_ADK_FALLBACK;

  if (!useCline && !useAdkFallback) {
    return {
      ok: false,
      error:
        'Cline runner is not configured. Set USE_CLINE_AGENT=true or use WEBSITE_EDIT_AGENT=adk.',
    };
  }

  const beforeHashes = await computeWorkspaceHashes(workspacePath);

  let systemPrompt = `You are editing a customer website repository in a local workspace.

Implement the owner's request directly in the website files so the local preview visibly reflects the change.

Rules:
- Edit only files inside the current workspace.
- Do NOT run: git commit, git push, npm run deploy, or any deploy command.
- Do NOT edit .env, .git, node_modules, .next, dist, build, private keys, lockfiles.
- Preserve real business facts.
- Do NOT invent phone numbers, addresses, reviews, certifications, prices, guarantees, awards, or years in business.
- For content or section requests, find the actual rendered homepage/content source and edit it.
- For style requests, find the actual CSS/theme/component styling and edit it.
- Prefer small targeted changes.
- Make sure the requested change is visible in the website preview.
- Do not explain implementation details to the business owner.`;

  if (mode === 'static') {
    systemPrompt += `\n\nThis project may only contain index.html, styles.css, and site.json. Edit those files directly.`;
  } else {
    systemPrompt += `\n\nThis is a real cloned GitLab website repository. Search and edit the appropriate source files.`;
  }

  let rawOutput = '';
  let clineError = '';

  if (useCline) {
    try {
      const { stdout, stderr, exitCode } = await runClineCli(
        workspacePath,
        systemPrompt,
        ownerMessage
      );
      rawOutput = [stdout, stderr].filter(Boolean).join('\n');
      if (exitCode !== 0) {
        clineError = stderr.trim() || `Cline exited with code ${exitCode}`;
      } else if (stderr && /\berror:/i.test(stderr)) {
        clineError = stderr.trim().slice(0, 800);
      }
    } catch (err) {
      clineError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  if (!useCline || clineError) {
    if (useAdkFallback) {
      try {
        const response = await fetch(`${ADK_CODING_AGENT_URL}/project-website-agent/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            workspacePath,
            message: ownerMessage,
            mode,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            ok: result.ok ?? false,
            summary: result.ownerMessage,
            changedFiles: result.changedFiles || [],
            rawOutput: JSON.stringify(result),
          };
        }
        return { ok: false, error: `ADK error: ${response.status}` };
      } catch (err) {
        return {
          ok: false,
          error: `ADK call failed: ${err instanceof Error ? err.message : 'Unknown'}`,
        };
      }
    }

    return {
      ok: false,
      error: clineError ? `Cline error: ${clineError}` : 'Cline runner is not configured.',
    };
  }

  const afterHashes = await computeWorkspaceHashes(workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);

  for (const fn of changedFiles) {
    if (isBlockedWorkspacePath(fn)) {
      return {
        ok: false,
        error: `Edit attempted to modify blocked file: ${fn}`,
        changedFiles,
      };
    }
  }

  if (changedFiles.length === 0) {
    const fallback = await tryLlmWorkspaceEdit(workspacePath, ownerMessage);
    if (fallback.ok) {
      const afterFallback = await computeWorkspaceHashes(workspacePath);
      const fallbackChanged = getChangedFilesFromHashes(beforeHashes, afterFallback);
      if (fallbackChanged.length > 0) {
        return {
          ok: true,
          summary: fallback.summary || 'Updated your website.',
          changedFiles: fallbackChanged,
          rawOutput: rawOutput?.slice(0, 500),
        };
      }
    }

    const hint = clineError
      ? `Cline could not apply edits: ${clineError}`
      : rawOutput
        ? 'Cline finished but did not modify any files (the model may not support tool calls on your proxy).'
        : 'No files were changed by the edit.';

    return {
      ok: false,
      error: hint,
      changedFiles: [],
      rawOutput: rawOutput?.slice(0, 500),
    };
  }

  const htmlChanged = changedFiles.some(
    (f) => f.endsWith('.html') || f.endsWith('.htm') || f.endsWith('.tsx') || f.endsWith('.jsx')
  );
  const cssChanged = changedFiles.some(
    (f) => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.sass') || f.endsWith('.less')
  );

  let summary = 'Updated your website.';
  if (htmlChanged && cssChanged) {
    summary = 'Updated the page content and styling.';
  } else if (htmlChanged) {
    summary = 'Updated the page content.';
  } else if (cssChanged) {
    summary = 'Updated the styling.';
  }

  return {
    ok: true,
    summary,
    changedFiles,
    rawOutput: rawOutput?.slice(0, 500),
  };
}
