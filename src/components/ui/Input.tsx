import { cn } from '@/lib/cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-[17px] text-[#1d1d1f]',
        'placeholder:text-[#86868b]',
        'focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20',
        'disabled:bg-[#f5f5f7] disabled:text-[#86868b]',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-[17px] text-[#1d1d1f]',
        'placeholder:text-[#86868b]',
        'focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20',
        'disabled:bg-[#f5f5f7] disabled:text-[#86868b]',
        className
      )}
      {...props}
    />
  );
}
