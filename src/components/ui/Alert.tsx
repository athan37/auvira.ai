import { cn } from '@/lib/cn';

type Variant = 'info' | 'success' | 'warning' | 'error';

const styles: Record<Variant, string> = {
  info: 'glass-panel bg-blue-50/30 border-blue-200/50 text-[#1d1d1f]',
  success: 'glass-panel bg-emerald-50/30 border-emerald-200/50 text-emerald-900',
  warning: 'glass-panel bg-amber-50/30 border-amber-200/50 text-amber-900',
  error: 'glass-panel bg-red-50/30 border-red-200/50 text-red-800',
};

export function Alert({
  variant = 'info',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={cn('rounded-2xl border px-4 py-3 text-sm', styles[variant], className)}
      role="alert"
      {...props}
    >
      {children}
    </div>
  );
}
