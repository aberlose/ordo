import { CircleCheck, Inbox, Play, type LucideIcon, type LucideProps } from 'lucide-react';

/** Lucide icons available for columns. The full searchable set comes with the column settings feature. */
const ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  play: Play,
  'circle-check': CircleCheck,
};

export function ColumnIcon({ icon, ...props }: { icon: string | null } & Omit<LucideProps, 'name'>) {
  const Icon = (icon && ICONS[icon]) || Inbox;
  return <Icon aria-hidden {...props} />;
}
