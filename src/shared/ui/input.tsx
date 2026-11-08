import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.ts';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  inputSize?: 'default' | 'sm';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', error = false, inputSize = 'default', disabled, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      className={cn(
        'w-full rounded-md border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400',
        'focus-visible:outline-none focus-visible:ring-1 transition-colors shadow-sm',
        'disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950 disabled:cursor-not-allowed',
        inputSize === 'default' ? 'h-9 px-3 text-sm' : 'h-8 px-2.5 text-xs',
        error
          ? 'border-rose-500 dark:border-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400 text-rose-900 dark:text-rose-100'
          : 'border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
        className
      )}
      {...props}
    />
  );
});
