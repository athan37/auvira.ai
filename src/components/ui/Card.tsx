import { cn } from '@/lib/cn';

type CardVariant = 'default' | 'glass';

const variantClasses: Record<CardVariant, string> = {
  default: 'rounded-2xl border border-[#d2d2d7]/80 bg-white shadow-card',
  glass: 'glass-card',
};

export function Card({
  className,
  variant = 'default',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div className={cn(variantClasses[variant], className)} {...props}>
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
    <div className={cn('px-4 py-3 border-b border-[#d2d2d7]/80', className)} {...props}>
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
