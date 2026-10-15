import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export function DropdownMenuContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={24}
        className={cn(
          'z-50 flex min-w-58 flex-col gap-px rounded-card border border-border bg-surface p-1.5 text-text shadow-pop outline-none',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemClass =
  'flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-body outline-none select-none data-[highlighted]:bg-rail';

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(itemClass, className)} {...props} />;
}

/** A radio item with a check on the current value (mockup: tasks/Menus, status menu). */
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClass, 'data-[state=checked]:bg-accent-soft', className)} {...props}>
      {children}
      <span className="flex-1" />
      <Menu.ItemIndicator>
        <Check size={14} strokeWidth={2.6} className="text-accent" aria-hidden />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('mx-0.5 my-1 h-px bg-border', className)} {...props} />;
}
