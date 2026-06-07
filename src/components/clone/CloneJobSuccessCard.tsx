'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ACCENT, BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface GitLabInfo {
  repoUrl?: string;
  webUrl?: string;
  httpUrlToRepo?: string;
}

interface Deployment {
  provider: string;
  status: string;
  ready: boolean;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  vercelProjectName?: string;
}

interface Props {
  createdProjectId: string;
  deployment?: Deployment | null;
  gitlab?: GitLabInfo | null;
  suggestedTemplate?: { category: string; variant: string } | null;
}

export default function CloneJobSuccessCard({ createdProjectId, deployment, gitlab, suggestedTemplate }: Props) {
  return (
    <div className={cn(SURFACE.card, RADIUS.card, 'overflow-hidden', BORDER.hairline, 'border')}>
      <div className={cn('px-4 py-3 border-b', BORDER.hairline, 'bg-rose-50/60')}>
        <div className="flex items-center gap-2">
          <h2 className={cn('font-medium text-sm', TEXT.primary)}>Your website is ready!</h2>
          <Badge tone="success">Live</Badge>
        </div>
        <p className={cn('text-xs mt-0.5', TEXT.muted)}>Deployment complete and live</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {deployment?.liveUrl ? (
            <a href={deployment.liveUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Website
              </Button>
            </a>
          ) : (
            <div className={cn('inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm', SURFACE.alt, TEXT.tertiary)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Waiting for live URL...
            </div>
          )}
          <Link href={`/projects/${createdProjectId}`}>
            <Button variant="glass" size="sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Open editor
            </Button>
          </Link>
          {gitlab?.webUrl || gitlab?.repoUrl ? (
            <a href={gitlab.webUrl || gitlab.repoUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                View GitLab Repo
              </Button>
            </a>
          ) : null}
        </div>

        {deployment?.liveUrl && (
          <div className={cn('pt-3 border-t', BORDER.hairline)}>
            <p className={cn('text-xs font-semibold mb-2', TEXT.primary)}>Website preview</p>
            <div className={cn('rounded-xl overflow-hidden border bg-white', BORDER.hairline)}>
              <iframe
                src={deployment.liveUrl}
                className="w-full h-64 rounded-xl"
                title="Website preview"
                allowFullScreen
              />
            </div>
          </div>
        )}

        <div className={cn('pt-3 border-t space-y-1', BORDER.hairline)}>
          <p className={cn('text-xs font-semibold', TEXT.primary)}>What was created:</p>
          {gitlab?.repoUrl && <p className={cn('text-xs', TEXT.muted)}>• GitLab repository</p>}
          {deployment?.provider && <p className={cn('text-xs', TEXT.muted)}>• Vercel deployment</p>}
          {suggestedTemplate && (
            <p className={cn('text-xs', TEXT.muted)}>
              • Template: {suggestedTemplate.category} / {suggestedTemplate.variant}
            </p>
          )}
        </div>

        {deployment?.inspectorUrl && (
          <a
            href={deployment.inspectorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('text-xs hover:underline block', ACCENT.link)}
          >
            View Vercel deployment details →
          </a>
        )}
      </div>
    </div>
  );
}
