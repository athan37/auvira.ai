'use client';

import { cn } from '@/lib/cn';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Section wrapper for scratch intake form blocks. */
export function ScratchFormSection({ title, description, children, className }: Props) {
  return (
    <section className={cn('rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}
