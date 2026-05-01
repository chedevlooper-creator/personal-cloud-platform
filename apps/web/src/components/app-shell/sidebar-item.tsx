'use client';

import Link from 'next/link';
import type React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  action,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9',
        active
          ? 'bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_1px_0_0_hsl(var(--border)/0.4)]'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        collapsed ? 'mx-auto h-10 w-10 justify-center px-0 md:h-8 md:w-8' : 'md:h-8 md:text-[13px]',
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-sidebar-primary"
        />
      )}
      <Icon
        className={cn(
          'h-[17px] w-[17px] shrink-0 transition-colors',
          active ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge && (
            <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
          {action}
        </>
      )}
    </Link>
  );
}
