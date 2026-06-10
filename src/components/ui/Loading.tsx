'use client';

import { cn } from '@/lib/cn';
import { LOADING } from '@/content/productTheme';
import { LoadingDots } from './LoadingDots';

type LoadingVariant = 'dots' | 'inline';
type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Product loading indicator — progress-first, no spinners.
 * `sm` / `inline`: thin blue bar for buttons and rows.
 * `md`+ : four-dot mesh glow pulse for panel centers.
 */
export function Loading({
  size = 'md',
  variant = 'dots',
  label,
  className,
}: {
  size?: LoadingSize;
  variant?: LoadingVariant;
  label?: string;
  className?: string;
}) {
  const resolvedSize = variant === 'inline' ? 'sm' : size;
  const showLabel = Boolean(label) && resolvedSize !== 'sm';
  const dotSize = resolvedSize === 'md' ? 'md' : 'lg';

  const labelClass =
    resolvedSize === 'xl' || resolvedSize === 'lg'
      ? 'text-[17px] font-medium text-[#1d1d1f]'
      : resolvedSize === 'md'
        ? 'text-base font-medium text-[#1d1d1f]'
        : 'text-sm text-[#6e6e73]';

  if (resolvedSize === 'sm') {
    return (
      <span
        className={cn('inline-flex items-center', className)}
        role="status"
        aria-live="polite"
        aria-label={label ?? 'Loading'}
      >
        <span className={LOADING.inlineBar} aria-hidden />
      </span>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center justify-center gap-3',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
    >
      <LoadingDots size={dotSize} />
      {showLabel && (
        <p className={cn(labelClass, 'text-center max-w-xs')}>{label}</p>
      )}
    </div>
  );
}

export type { LoadingSize, LoadingVariant };
