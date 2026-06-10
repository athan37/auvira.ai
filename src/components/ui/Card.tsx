import { cn } from '@/lib/cn';
import { CONTROL } from '@/content/productTheme';

type CardVariant = 'default' | 'glass' | 'solid';

const variantClasses: Record<CardVariant, string> = {
  default: 'glass-card shadow-card',
  glass: 'glass-card shadow-card',
  solid: 'rounded-2xl border border-[#d2d2d7]/80 bg-white shadow-card',
};

export function Card({
  className,
  variant = 'default',
  interactive = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  /** Adds hover elevation for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        interactive && CONTROL.cardInteractive,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3 border-b border-white/40', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}
