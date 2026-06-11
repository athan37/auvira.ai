import { cn } from '@/lib/cn';
import { BRAND } from '@/content/marketing';

const MARK_SIZES = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const;

/** Scalable Auvira.ai mark — inline SVG wrapping the transparent PNG. */
export function AuviraLogoMark({
  className,
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof MARK_SIZES;
}) {
  return (
    <svg
      viewBox="0 0 798 688"
      className={cn(MARK_SIZES[size], 'block shrink-0', className)}
      role="img"
      aria-label={BRAND.logoAlt}
    >
      <title>{BRAND.logoAlt}</title>
      <image href={BRAND.logoPngSrc} width="798" height="688" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
