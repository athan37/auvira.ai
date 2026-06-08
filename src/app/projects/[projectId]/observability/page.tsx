'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectObservabilityDashboard } from '@/components/project/ProjectObservabilityDashboard';
import { ProjectWorkspaceTabs } from '@/components/project/ProjectWorkspaceTabs';
import { TEXT } from '@/content/productTheme';

/** Per-project observability page shell — editor chrome + workspace tabs. */
export default function ProjectObservabilityPage() {
  const params = useParams();
  const projectId = String(params.projectId ?? '');

  return (
    <AppShell
      variant="editor"
      breadcrumb={
        <span className="truncate">
          <Link
            href="/dashboard"
            className="text-brand-600 hover:text-brand-500 hover:underline"
          >
            Dashboard
          </Link>
          <span className={`mx-1 ${TEXT.muted}`}>/</span>
          <span className={TEXT.primary}>Project</span>
        </span>
      }
    >
      <div className="px-3 lg:px-4 pt-3">
        <ProjectWorkspaceTabs projectId={projectId} />
      </div>
      <ProjectObservabilityDashboard projectId={projectId} />
    </AppShell>
  );
}
