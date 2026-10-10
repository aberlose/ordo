import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-kbd border border-border bg-surface px-1.5 font-mono text-kbd text-text-2',
        className,
      )}
      {...props}
    />
  );
}
