import { cn } from '@/lib/cn';

type Tone = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'rose';

const tones: Record<Tone, string> = {
  default: 'bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7]/80',
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm ring-1 ring-inset ring-white/40',
  warning: 'bg-amber-50 text-amber-900 border border-amber-200/80 shadow-sm',
  error: 'bg-red-50 text-red-800 border border-red-200/80 shadow-sm',
  info: 'bg-rose-50 text-rose-800 border border-rose-200/80 shadow-sm ring-1 ring-inset ring-white/40',
  brand: 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm ring-1 ring-inset ring-white/40',
  rose: 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-sm ring-1 ring-inset ring-white/40',
};

export function Badge({
  className,
  tone = 'default',
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function statusToBadgeTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ready':
    case 'deployed':
      return 'success';
    case 'failed':
    case 'trigger_failed':
      return 'error';
    case 'incomplete':
    case 'validating':
    case 'building':
    case 'running':
    case 'triggered':
      return 'warning';
    case 'reverted':
      return 'default';
    default:
      return 'info';
  }
}
