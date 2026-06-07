'use client';

import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/components/motion/tokens';
import { RoseOrbitSvg } from './RoseOrbitSvg';

type LoadingVariant = 'orbit' | 'inline';
type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

const svgSizes: Record<LoadingSize, number> = {
  sm: 22,
  md: 44,
  lg: 64,
  xl: 80,
};

/** Inline / panel SVG ring loader. Full-screen waits use LoadingShell. */
export function Loading({
  size = 'md',
  variant = 'orbit',
  label,
  className,
}: {
  size?: LoadingSize;
  variant?: LoadingVariant;
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const resolvedSize = variant === 'inline' ? 'sm' : size;
  const svgSize = svgSizes[resolvedSize];
  const showLabel = Boolean(label) && resolvedSize !== 'sm';

  const labelClass =
    resolvedSize === 'xl'
      ? 'text-[17px] font-medium text-[#1d1d1f]'
      : resolvedSize === 'lg'
        ? 'text-base font-medium text-[#1d1d1f]'
        : 'text-sm text-[#6e6e73]';

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
      <RoseOrbitSvg size={svgSize} reduced={reduced} />
      {showLabel && (
        <p className={cn(labelClass, 'text-center max-w-xs')}>{label}</p>
      )}
    </div>
  );
}

export type { LoadingSize, LoadingVariant };
