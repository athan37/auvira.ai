'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { ACCENT } from '@/content/productTheme';
import { cn } from '@/lib/cn';
import { BrandLogo } from '@/components/marketing/BrandLogo';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';

type ShellVariant = 'default' | 'editor' | 'wizard' | 'minimal';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects/new/scratch', label: 'Start with a prompt' },
  { href: '/projects/new/clone', label: 'Refresh from URL' },
];

/** Authenticated app chrome — Apple glass aesthetic. */
export function AppShell({
  variant = 'default',
  title,
  breadcrumb,
  actions,
  children,
}: {
  variant?: ShellVariant;
  title?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showSideNav = variant === 'default';

  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col">
      <header className="sticky top-0 z-40 glass-nav">
        <PageContainer className="flex h-12 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {showSideNav && (
              <button
                type="button"
                className="md:hidden p-2 rounded-full text-[#6e6e73] hover:bg-black/5"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <Link href="/dashboard" className="shrink-0">
              <BrandLogo size="sm" />
            </Link>
            {breadcrumb && (
              <span className="hidden sm:flex items-center gap-2 text-sm text-[#86868b] truncate">
                <span aria-hidden>/</span>
                {breadcrumb}
              </span>
            )}
            {title && !breadcrumb && (
              <span className="hidden sm:block text-sm font-medium text-[#6e6e73] truncate">{title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {session?.user?.email && (
              <span className="hidden lg:inline text-xs text-[#86868b] max-w-[160px] truncate">
                {session.user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
              Sign out
            </Button>
          </div>
        </PageContainer>
      </header>

      <div className="flex flex-1 min-h-0">
        {showSideNav && (
          <aside
            className={cn(
              'border-r border-[#d2d2d7]/60 bg-white/60 backdrop-blur-xl w-52 shrink-0',
              mobileOpen ? 'absolute inset-y-12 left-0 z-30 shadow-glass md:static md:shadow-none' : 'hidden md:block'
            )}
          >
            <nav className="p-3 space-y-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'block rounded-xl px-3 py-2 text-sm font-normal transition-colors',
                      active
                        ? ACCENT.pill
                        : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <main className={cn('flex-1 min-h-0', variant === 'editor' && 'flex flex-col')}>
          {children}
        </main>
      </div>
    </div>
  );
}
