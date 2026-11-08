import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1)] select-none',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
