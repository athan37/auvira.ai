export interface CreateVercelProjectInput {
  name: string;
  gitlabProjectId: number;
  gitlabRepoUrl: string;
  gitlabPathWithNamespace?: string;
  framework?: "nextjs";
}

export interface VercelProjectResult {
  id: string;
  name: string;
  url?: string;
  projectUrl?: string;
  liveUrl?: string;
}

export interface DeploymentStatus {
  status: string;
  url?: string;
  readyState?: string;
}

export interface VercelDeploymentResult {
  provider: 'vercel';
  status: 'triggered' | 'trigger_failed' | 'pending';
  ready: boolean;
  projectId: string;
  projectUrl: string;
  vercelProjectName: string;
  deployHookCreated: boolean;
  deployTriggered: boolean;
  deployHookId?: string;
  deployHookUrl?: string;
  triggeredAt?: string;
  expectedProductionUrl?: string;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  note: string;
  error?: string;
  job?: unknown;
  // Debug info (never logged to client)
  _debug?: {
    teamScopeUsed: string;
    vercelTeamIdUsed: boolean;
    gitRepositoryRepo: string;
    deployHookTriggerStatus?: number;
    deployHookTriggerResponse?: string;
  };
}

export interface VercelDeploymentInfo {
  deploymentId: string;
  deploymentUrl: string;
  inspectorUrl: string;
  readyState: string;
  createdAt: number;
  readyAt?: number;
}

export interface VercelListDeploymentsResponse {
  deployments: Array<{
    uid: string;
    name: string;
    url: string;
    state: string;
    createdAt: number;
    readyAt?: number;
    target?: string;
    meta?: Record<string, string>;
  }>;
}