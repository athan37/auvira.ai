import { cn } from '@/lib/cn';
import { LOADING } from '@/content/productTheme';

/** Four-dot mesh glow loader — sky, lavender, lemon, blue. */
export function LoadingDots({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(size === 'lg' ? LOADING.dotsLg : LOADING.dots)}
      aria-hidden
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
