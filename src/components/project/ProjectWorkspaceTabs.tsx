'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { BORDER, RADIUS, TEXT } from '@/content/productTheme';

type WorkspaceTab = 'editor' | 'observability';

const TABS: Array<{ id: WorkspaceTab; label: string; suffix: string }> = [
  { id: 'editor', label: 'Editor', suffix: '' },
  { id: 'observability', label: 'Observability', suffix: '/observability' },
];

/** Top-level project workspace switcher — editor vs observability dashboard. */
export function ProjectWorkspaceTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const active: WorkspaceTab = pathname?.endsWith('/observability') ? 'observability' : 'editor';

  return (
    <nav
      className={cn(
        'inline-flex glass-panel overflow-hidden shrink-0 border',
        RADIUS.card,
        BORDER.hairline
      )}
      aria-label="Project workspace"
    >
      {TABS.map((tab) => {
        const href = `/projects/${projectId}${tab.suffix}`;
        const isActive = active === tab.id;

        return (
          <Link
            key={tab.id}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? cn('editor-tab-active bg-white/60', TEXT.primary)
                : cn(TEXT.muted, 'hover:text-[#1d1d1f] hover:bg-white/40')
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
