import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
type Size = 'sm' | 'md' | 'lg';

export const buttonVariants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 focus-visible:ring-brand-500/30 border border-transparent',
  secondary:
    'bg-transparent text-brand-600 hover:underline underline-offset-4 border border-transparent px-0',
  glass:
    'glass-panel text-[#1d1d1f] hover:bg-white/90 focus-visible:ring-brand-500/20 border border-white/60',
  ghost:
    'text-[#6e6e73] hover:text-[#1d1d1f] focus-visible:ring-brand-500/10 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/30 border border-transparent',
};

export const buttonSizes: Record<Size, string> = {
  sm: 'h-8 px-4 text-xs rounded-full',
  md: 'h-9 px-5 text-sm rounded-full',
  lg: 'h-11 px-6 text-base rounded-full',
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
    'inline-flex items-center justify-center gap-2 font-normal transition-all duration-150 ease-apple',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

export type ButtonVariant = Variant;
export type ButtonSize = Size;
