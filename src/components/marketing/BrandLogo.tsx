import { cn } from '@/lib/cn';
import { AuviraLogoMark } from './AuviraLogoMark';

/** Auvira.ai wordmark with gradient SVG mark. */
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
  const textSize = size === 'sm' ? 'text-sm' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-2 leading-none', className)}>
      <AuviraLogoMark
        size={size}
        className={cn('relative', size === 'sm' ? '-top-0.5' : 'top-0')}
      />
      {showName && (
        <span
          className={cn(
            'font-semibold tracking-tight leading-none',
            inverted ? 'text-white' : 'text-[#1d1d1f]',
            textSize
          )}
        >
          Auvira
          <span className={cn(inverted ? 'text-brand-ai-inverted' : 'text-brand-ai')}>.ai</span>
        </span>
      )}
    </span>
  );
}
