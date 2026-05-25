import { cn } from '@/lib/cn';

type Tone = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  default: 'bg-zinc-100 text-zinc-700 border border-zinc-200/80',
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-900 border border-amber-200/80',
  error: 'bg-red-50 text-red-800 border border-red-200/80',
  info: 'bg-zinc-50 text-zinc-700 border border-zinc-200/80',
  brand: 'bg-zinc-950 text-white border border-zinc-950',
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
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
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
