import { cn } from '@/lib/cn';
import { LOADING } from '@/content/productTheme';

/** Rectangular mesh shimmer placeholder. */
export function SkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(LOADING.skeleton, 'rounded-xl', className)}
      aria-hidden
    />
  );
}

/** Single-line text shimmer placeholder. */
export function SkeletonText({
  className,
  width = 'w-full',
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      className={cn(LOADING.skeleton, 'h-4 rounded-md', width, className)}
      aria-hidden
    />
  );
}

/** Circular shimmer placeholder (avatars, thumbs). */
export function SkeletonCircle({
  className,
  size = 'h-10 w-10',
}: {
  className?: string;
  size?: string;
}) {
  return (
    <div
      className={cn(LOADING.skeleton, 'rounded-full', size, className)}
      aria-hidden
    />
  );
}
