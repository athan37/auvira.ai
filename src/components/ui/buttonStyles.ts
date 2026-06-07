import { cn } from '@/lib/cn';

type Variant =
  | 'primary'
  | 'primaryBlue'
  | 'secondary'
  | 'secondaryLink'
  | 'ghost'
  | 'danger'
  | 'glass'
  | 'primaryRose'
  | 'secondaryRose';
type Size = 'sm' | 'md' | 'lg';

export const buttonVariants: Record<Variant, string> = {
  primary:
    'btn-rose-primary text-white focus-visible:ring-rose-500/35 border border-white/25',
  primaryBlue:
    'bg-brand-600 text-white hover:bg-brand-500 focus-visible:ring-brand-500/30 border border-transparent',
  primaryRose:
    'btn-rose-primary text-white focus-visible:ring-rose-500/35 border border-white/25',
  secondary:
    'btn-rose-outline text-rose-700 hover:text-rose-600 focus-visible:ring-rose-500/35 border-rose-300/60',
  secondaryLink:
    'bg-transparent text-rose-700 hover:text-rose-600 hover:underline underline-offset-4 border border-transparent px-0',
  secondaryRose:
    'bg-transparent text-rose-700 hover:text-rose-600 hover:underline underline-offset-4 border border-transparent px-0',
  glass: 'btn-glass text-[#1d1d1f] focus-visible:ring-rose-500/20',
  ghost:
    'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04] focus-visible:ring-rose-500/10 border border-transparent',
  danger: 'btn-danger text-white focus-visible:ring-red-500/30 border border-white/20',
};

export const buttonSizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-xs rounded-full',
  md: 'h-10 px-5 text-sm rounded-full',
  lg: 'h-11 px-7 text-base rounded-full',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}): string {
  return cn(
    'relative inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] antialiased transition-all duration-150 ease-apple',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

export type ButtonVariant = Variant;
export type ButtonSize = Size;
