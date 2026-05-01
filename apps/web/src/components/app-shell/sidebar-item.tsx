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
        'group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-sm font-medium outline-none transition-[background-color,color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] md:h-9',
        active
          ? 'bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--border)_60%,transparent)]'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        collapsed ? 'mx-auto h-10 w-10 justify-center px-0 md:h-8 md:w-8' : 'md:h-8 md:text-[13px]',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_12px_0_color-mix(in_oklch,var(--sidebar-primary)_55%,transparent)]',
            collapsed && 'left-1/2 top-auto bottom-1 h-[3px] w-5 -translate-x-1/2 translate-y-0 rounded-t-full',
          )}
        />
      )}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_50%,color-mix(in_oklch,var(--sidebar-primary)_18%,transparent),transparent_60%)]"
        />
      )}
      <Icon
        className={cn(
          'relative z-10 h-[17px] w-[17px] shrink-0 transition-[color,transform] duration-200',
          active
            ? 'text-sidebar-primary [filter:drop-shadow(0_0_6px_color-mix(in_oklch,var(--sidebar-primary)_45%,transparent))]'
            : 'text-muted-foreground group-hover:translate-x-[1px] group-hover:text-foreground',
        )}
      />
      {!collapsed && (
        <>
          <span className="relative z-10 min-w-0 flex-1 truncate">{label}</span>
          {badge && (
            <span className="relative z-10 rounded-full border border-sidebar-border/60 bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
          {action}
        </>
      )}
    </Link>
  );
}
