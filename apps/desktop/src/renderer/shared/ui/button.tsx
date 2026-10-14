import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-meta font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: '[background:var(--accent-bg)] text-accent-fg hover:brightness-105',
        secondary: 'border border-border bg-surface text-text hover:bg-rail',
        ghost: 'text-text-2 hover:bg-rail',
        soft: 'bg-accent-soft text-accent font-semibold hover:brightness-95',
        danger: 'bg-danger text-danger-fg font-semibold hover:brightness-105',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-3.5',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'sm' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
