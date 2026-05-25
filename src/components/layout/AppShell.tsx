'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';

type ShellVariant = 'default' | 'editor' | 'wizard' | 'minimal';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects/new/clone', label: 'New from URL' },
];

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
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <PageContainer className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {showSideNav && (
              <button
                type="button"
                className="md:hidden p-2 rounded-md text-zinc-600 hover:bg-zinc-100"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <Link href="/dashboard" className="font-semibold text-zinc-950 shrink-0 tracking-tight">
              Site Agent
            </Link>
            {breadcrumb && (
              <span className="hidden sm:flex items-center gap-2 text-sm text-zinc-500 truncate">
                <span aria-hidden>/</span>
                {breadcrumb}
              </span>
            )}
            {title && !breadcrumb && (
              <span className="hidden sm:block text-sm font-medium text-zinc-600 truncate">{title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {session?.user?.email && (
              <span className="hidden lg:inline text-xs text-zinc-500 max-w-[160px] truncate">
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
              'border-r border-zinc-200 bg-white w-52 shrink-0',
              mobileOpen ? 'absolute inset-y-14 left-0 z-30 shadow-card-hover md:static md:shadow-none' : 'hidden md:block'
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
                      'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
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
