'use client';

import { Button } from '@/components/ui/Button';
import { BORDER, RADIUS, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface BuildStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface Deployment {
  provider: string;
  status: string;
  ready: boolean;
  vercelProjectId?: string;
  vercelProjectName?: string;
  expectedProductionUrl?: string;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  note?: string;
  error?: string;
}

interface Props {
  status: string;
  buildSteps: BuildStep[];
  deployment?: Deployment | null;
  stageLabel: string;
}

const BUILD_STEP_LABELS: Record<string, string> = {
  generate_site_spec: 'Preparing website structure',
  generate_files: 'Generating Next.js website files',
  validate_build: 'Running local build gate',
  create_gitlab_project: 'Creating GitLab repository',
  commit_files: 'Committing generated code',
  create_vercel_project: 'Creating Vercel project',
  trigger_deployment: 'Starting Vercel deployment',
  wait_for_vercel: 'Waiting for Vercel to finish building',
};

function getStepIcon(step: BuildStep) {
  switch (step.status) {
    case 'done': return '✓';
    case 'failed': return '✗';
    case 'running': return '◐';
    default: return '○';
  }
}

function getStepColor(step: BuildStep) {
  switch (step.status) {
    case 'done': return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'failed': return 'text-red-600 bg-red-50 border-red-200';
    case 'running': return 'text-rose-600 bg-rose-50 border-rose-200';
    default: return cn(TEXT.tertiary, 'bg-[#f5f5f7] border-[#d2d2d7]/60');
  }
}

function stepDuration(step: BuildStep): string | null {
  if (!step.startedAt) return null;
  const start = new Date(step.startedAt).getTime();
  const end = step.completedAt ? new Date(step.completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 2) return null;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function BuildDeployProgressCard({ status, buildSteps, deployment, stageLabel }: Props) {
  const activeSteps = buildSteps.filter(s => s.key !== 'wait_for_vercel');
  const waitStep = buildSteps.find(s => s.key === 'wait_for_vercel');

  return (
    <div className={cn('glass-card overflow-hidden', BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b bg-rose-50/60', BORDER.hairline)}>
        <h2 className={cn('font-medium text-sm text-rose-900')}>Build & Deploy Progress</h2>
        <p className="text-xs text-rose-700 mt-0.5">{stageLabel}</p>
      </div>
      <div className="p-4 space-y-3">
        {activeSteps.map((step) => {
          const duration = stepDuration(step);
          return (
            <div key={step.key} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', getStepColor(step))}>
              <span className="text-base w-5 text-center">{getStepIcon(step)}</span>
              <span className="text-sm flex-1">{BUILD_STEP_LABELS[step.key] || step.key}</span>
              {duration && <span className="text-xs opacity-75">{duration}</span>}
              {step.status === 'failed' && step.error && (
                <span className="text-xs text-red-500" title={step.error}>⚠ error</span>
              )}
            </div>
          );
        })}

        {(waitStep || deployment) && (
          <div className={cn(
            'mt-2 px-3 py-2 rounded-lg border',
            waitStep?.status === 'running'
              ? 'text-rose-600 bg-rose-50 border-rose-200'
              : cn(TEXT.tertiary, 'bg-[#f5f5f7] border-[#d2d2d7]/60')
          )}>
            {waitStep ? (
              <>
                <span className="text-base w-5 text-center inline-block">
                  {waitStep.status === 'done' ? '✓' : waitStep.status === 'running' ? '◐' : '○'}
                </span>
                <span className="text-sm ml-2">Waiting for Vercel to finish building</span>
                {waitStep.status === 'done' && <span className="text-xs text-rose-600 ml-2">✓ done</span>}
              </>
            ) : (
              <span className="text-sm">Waiting for Vercel to finish building...</span>
            )}
          </div>
        )}

        {deployment && (
          <div className={cn('mt-3 pt-3 border-t space-y-1.5', BORDER.hairline)}>
            {!deployment.vercelProjectId && !deployment.vercelProjectName && (
              <div className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                ⚠ Deployment metadata is missing. Please open the project workspace or retry.
              </div>
            )}
            {deployment.expectedProductionUrl && !deployment.ready && (
              <div className={cn('text-xs', TEXT.muted)}>
                Expected URL: <span className={cn('font-mono', TEXT.primary)}>{deployment.expectedProductionUrl}</span>
              </div>
            )}
            {deployment.note && !deployment.ready && (
              <div className={cn('text-xs', TEXT.tertiary)}>{deployment.note}</div>
            )}
            {deployment.inspectorUrl && (
              <a
                href={deployment.inspectorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-rose-700 hover:text-rose-600 hover:underline block"
              >
                View Vercel build →
              </a>
            )}
            {deployment.ready && deployment.liveUrl && (
              <a href={deployment.liveUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="sm">
                  ✓ Open live site
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
