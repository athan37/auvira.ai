/** Env-configurable limits for clone crawl and LLM prompt sizing. */
export interface CloneCrawlPromptLimits {
  maxPages: number;
  maxCharsPerPage: number;
  maxFactualChars: number;
  maxPlanPromptChars: number;
  maxProfilePromptChars: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Default clone crawl / prompt limits (overridable via env). */
export function getCloneCrawlPromptLimits(): CloneCrawlPromptLimits {
  return {
    maxPages: readIntEnv('CLONE_MAX_PAGES', 15),
    maxCharsPerPage: readIntEnv('CLONE_MAX_CHARS_PER_PAGE', 12000),
    maxFactualChars: readIntEnv('CLONE_MAX_FACTUAL_CHARS', 30000),
    maxPlanPromptChars: readIntEnv('CLONE_MAX_PLAN_PROMPT_CHARS', 30000),
    maxProfilePromptChars: readIntEnv('CLONE_MAX_PROFILE_PROMPT_CHARS', 30000),
  };
}
