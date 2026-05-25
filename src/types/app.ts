export type AppMode = "clone" | "scratch";

export type CloneStage =
  | "idle"
  | "crawling"
  | "review_crawl"
  | "extracting"
  | "planning"
  | "building"
  | "deploying"
  | "done"
  | "error";

export interface CrawlResult {
  sourceUrl: string;
  normalizedSourceUrl: string;
  domain: string;
  crawledAt: string;
  pages: Array<{
    url: string;
    title: string;
    text: string;
    headings: string[];
    deepText?: string; // full text from deep fetch
    schemaData?: Array<{ type: string; data: Record<string, unknown> }>;
    faqContent?: Array<{ q: string; a: string }>;
    altTexts?: string[];
    deepContent?: {
      fullText?: string;
      ogTags?: { ogTitle?: string; ogDescription?: string; ogImage?: string; ogType?: string };
      schemaData?: Array<{ type: string; data: Record<string, unknown> }>;
      faqContent?: Array<{ q: string; a: string }>;
      altTexts?: string[];
    };
  }>;
  siteSummary: {
    pageCount: number;
    totalTextLength: number;
    discoveredInternalLinks: number;
  };
  warnings: string[];
}

export type ScratchStage =
  | "idle"
  | "intake"
  | "planning"
  | "plan_ready"
  | "building"
  | "done"
  | "error";

export type GeneratedSiteState = {
  mode: "clone" | "scratch";
  projectId: number;
  repoUrl: string;
  httpUrlToRepo?: string;
  liveUrl?: string;
  projectName?: string;
  siteSpec: any;
  businessProfile?: any;
  websitePlan?: any;
  factualSiteData?: any;
  template?: any;
  generatedSiteValidation?: {
    ok: boolean;
    tempDir?: string;
    logs?: string;
    errors?: string[];
    durationMs?: number;
  };
  contentFidelity?: {
    passed: boolean;
    matchedContent: string[];
    missingContent: string[];
  };
  scratchValidation?: {
    ok: boolean;
    issues: string[];
  };
  deployment?: {
    provider: string;
    status: string;
    ready?: boolean;
    projectId?: string;
    projectUrl?: string;
    vercelProjectName?: string;
    deployHookCreated?: boolean;
    deployTriggered?: boolean;
    deployHookId?: string;
    deployHookUrl?: string;
    triggeredAt?: string;
    expectedProductionUrl?: string;
    liveUrl?: string | null;
    deploymentUrl?: string | null;
    inspectorUrl?: string | null;
    note?: string;
    error?: string;
  };
  lastCommit?: any;
  updatedAt: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};