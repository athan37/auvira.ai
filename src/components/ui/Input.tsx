import { cn } from '@/lib/cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950',
        'placeholder:text-zinc-400',
        'focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10',
        'disabled:bg-zinc-50 disabled:text-zinc-500',
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
        'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950',
        'placeholder:text-zinc-400',
        'focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10',
        'disabled:bg-zinc-50 disabled:text-zinc-500',
        className
      )}
      {...props}
    />
  );
}
