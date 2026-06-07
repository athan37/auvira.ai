'use client';

import { cn } from '@/lib/cn';
import { BORDER, TEXT } from '@/content/productTheme';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Section wrapper for scratch intake form blocks. */
export function ScratchFormSection({ title, description, children, className }: Props) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-white p-5 sm:p-6 space-y-4',
        BORDER.hairline,
        className
      )}
    >
      <div>
        <h2 className={cn('text-base font-semibold', TEXT.primary)}>{title}</h2>
        {description && <p className={cn('text-sm mt-0.5', TEXT.muted)}>{description}</p>}
      </div>
      {children}
    </section>
  );
}
