import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.ts';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
