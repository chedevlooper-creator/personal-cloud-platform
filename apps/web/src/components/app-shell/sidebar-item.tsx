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
      className={cn(
        'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border border-[#606166] bg-[#151615] text-[#F2F2F2]'
          : 'text-[#A8A8A8] hover:bg-[#303134] hover:text-[#F2F2F2]',
        collapsed ? 'mx-auto h-8 w-8 justify-center px-0' : 'h-8 text-[15px] font-normal',
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge && (
            <span className="rounded-full bg-[#4C4C4C] px-1.5 py-0.5 text-[9px] font-normal text-[#BEBEBE]">
              {badge}
            </span>
          )}
          {action}
        </>
      )}
    </Link>
  );
}
