import { cn } from '@/lib/cn';

type Tone = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand' | 'rose';

const tones: Record<Tone, string> = {
  default:
    'bg-white/40 text-[#1d1d1f] border border-white/50 backdrop-blur-sm shadow-sm',
  success:
    'bg-emerald-50/60 text-emerald-800 border border-emerald-200/60 backdrop-blur-sm shadow-sm ring-1 ring-inset ring-white/40',
  warning:
    'bg-amber-50/60 text-amber-900 border border-amber-200/60 backdrop-blur-sm shadow-sm',
  error: 'bg-red-50/60 text-red-800 border border-red-200/60 backdrop-blur-sm shadow-sm',
  info: 'bg-blue-50/60 text-blue-800 border border-blue-200/60 backdrop-blur-sm shadow-sm ring-1 ring-inset ring-white/40',
  brand:
    'bg-blue-50/60 text-blue-700 border border-blue-200/60 backdrop-blur-sm shadow-sm ring-1 ring-inset ring-white/40',
  rose:
    'bg-rose-50/60 text-rose-700 border border-rose-200/60 backdrop-blur-sm shadow-sm ring-1 ring-inset ring-white/40',
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
