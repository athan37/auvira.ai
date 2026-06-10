import { cn } from '@/lib/cn';
import { SURFACE } from '@/content/productTheme';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        SURFACE.input,
        'h-11 w-full rounded-xl px-4 text-[17px] text-[#1d1d1f]',
        'placeholder:text-[#86868b]',
        'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        'disabled:opacity-60 disabled:text-[#86868b]',
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
        SURFACE.input,
        'w-full rounded-xl px-4 py-3 text-[17px] text-[#1d1d1f]',
        'placeholder:text-[#86868b]',
        'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        'disabled:opacity-60 disabled:text-[#86868b]',
        className
      )}
      {...props}
    />
  );
}
