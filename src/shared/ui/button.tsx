import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export type ButtonSize = 'default' | 'sm' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] dark:text-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 border border-transparent shadow-sm',
  secondary:
    'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] shadow-sm',
  outline:
    'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] shadow-sm',
  ghost:
    'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.99] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 border border-transparent',
  destructive:
    'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-[0.99] dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800 dark:hover:bg-rose-950/80 shadow-sm',
};

const sizeStyles: Record<ButtonSize, string> = {
  default: 'h-9 px-3.5 text-sm gap-2',
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  icon: 'h-9 w-9 p-0 justify-center',
  'icon-sm': 'h-8 w-8 p-0 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    isLoading = false,
    leftIcon,
    rightIcon,
    className,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-1',
        'transition-all duration-150',
        'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});
