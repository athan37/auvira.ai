import { cn } from '@/lib/cn';

/** Glass dark toast pill for transient feedback. */
export function Toast({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'glass-dark fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white/90 shadow-glass ring-1 ring-rose-500/25',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
