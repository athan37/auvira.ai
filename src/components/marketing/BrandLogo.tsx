import { cn } from '@/lib/cn';
import { BRAND } from '@/content/marketing';

/** Minimal monochrome wordmark. */
export function BrandLogo({
  className,
  showName = true,
  size = 'md',
  inverted = false,
}: {
  className?: string;
  showName?: boolean;
  size?: 'sm' | 'md';
  inverted?: boolean;
}) {
  const iconSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-sm' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-lg border',
          inverted
            ? 'border-white/20 bg-white/10'
            : 'border-[#d2d2d7]/80 bg-[#f5f5f7]',
          iconSize
        )}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className={cn('h-4 w-4', inverted ? 'text-white' : 'text-[#1d1d1f]')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12h8M8 8h5" strokeLinecap="round" />
        </svg>
      </span>
      {showName && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            inverted ? 'text-white' : 'text-[#1d1d1f]',
            textSize
          )}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
