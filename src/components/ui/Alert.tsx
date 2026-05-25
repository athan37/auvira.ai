import { cn } from '@/lib/cn';

type Variant = 'info' | 'success' | 'warning' | 'error';

const styles: Record<Variant, string> = {
  info: 'bg-zinc-50 border-zinc-200 text-zinc-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  error: 'bg-red-50 border-red-200 text-red-800',
};

export function Alert({
  variant = 'info',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={cn('rounded-md border px-3 py-2 text-sm', styles[variant], className)}
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
}
