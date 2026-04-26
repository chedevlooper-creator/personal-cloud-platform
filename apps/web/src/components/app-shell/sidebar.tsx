'use client';

import { useState } from 'react';
import type React from 'react';
import {
  Bell,
  Camera,
  ChevronDown,
  Clock3,
  Folder,
  Globe2,
  Home,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  SquareTerminal,
  TerminalSquare,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { SidebarItem } from '@/components/app-shell/sidebar-item';
import { WorkspaceAccountCard } from '@/components/app-shell/workspace-account-card';

const primaryItems = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Files', href: '/files', icon: Folder, searchable: true },
  { label: 'Chat', href: '/chats', icon: MessageCircle },
  { label: 'Automations', href: '/automations', icon: Clock3 },
];

const moreItems = [
  { label: 'Hosting', href: '/hosting', icon: Globe2 },
  { label: 'Terminal', href: '/terminal', icon: TerminalSquare },
  { label: 'Snapshots', href: '/snapshots', icon: Camera },
];

const secondaryItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({
  user,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: {
  user?: AuthUser;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(true);

  const sidebarContent = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card text-foreground transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquareTerminal className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">CloudMind</span>
          )}
        </div>
        <div className="flex items-center">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Close menu"
            aria-label="Close menu"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => onMobileOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {/* Primary */}
        <div className="space-y-0.5">
          {primaryItems.map((item) => (
            <SidebarItem
              key={item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              active={isActive(pathname, item.href)}
              action={
                item.searchable ? (
                  <button
                    type="button"
                    title="Search files"
                    aria-label="Search files"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      window.dispatchEvent(new Event('app:open-command-palette'));
                    }}
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                ) : null
              }
            />
          ))}
        </div>

        {/* More section */}
        <div className="mt-2">
          <button
            type="button"
            title="More"
            aria-label="Toggle more navigation"
            className={cn(
              'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-0'
            )}
            onClick={() => setMoreOpen((value) => !value)}
          >
            {collapsed ? (
              <MoreHorizontal className="h-4 w-4" />
            ) : (
              <ChevronDown className={cn('h-4 w-4 transition-transform', !moreOpen && '-rotate-90')} />
            )}
            {!collapsed && <span>More</span>}
          </button>
          {moreOpen && (
            <div className="mt-0.5 space-y-0.5">
              {moreItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Secondary */}
        <div className="mt-2 space-y-0.5">
          {secondaryItems.map((item) => (
            <SidebarItem
              key={item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="mb-2 flex items-center justify-between px-1">
            <ThemeToggle />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Notifications"
              aria-label="Notifications"
              className="text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        )}
        <WorkspaceAccountCard user={user} collapsed={collapsed} />
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden shrink-0 md:block">{sidebarContent}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 bg-black/60"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="relative h-full w-[260px] max-w-[88vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
