'use client';

import { cn } from '@/lib/cn';
import { SURFACE } from '@/content/productTheme';

/** Glass card shell for intro marketing demos. */
export function IntroDemoFrame({
  children,
  className,
  label,
  header,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  header?: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        SURFACE.card,
        'p-5 transition-all hover:border-rose-highlight hover:shadow-rose-glass',
        className
      )}
    >
      {header}
      {children}
    </div>
  );
}
