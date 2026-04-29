'use client';

import type React from 'react';
import { Menu, Plus, Search, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AuthUser } from '@/lib/auth';

const titles: Record<string, string> = {
  '/dashboard': 'Home',
  '/files': 'Files',
  '/chats': 'Chat',
  '/automations': 'Automations',
  '/terminal': 'Terminal',
  '/hosting': 'Hosting',
  '/snapshots': 'Snapshots',
  '/settings': 'Settings',
};

export function MainCanvas({
  children,
  user,
  onOpenSidebar,
}: {
  children: React.ReactNode;
  user?: AuthUser;
  onOpenSidebar: () => void;
}) {
  const pathname = usePathname();
  const title = titles[pathname] || (pathname.startsWith('/workspace') ? 'Workspace' : 'Home');

  return (
    <section className="relative min-w-0 flex-1">
      {/* Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Open sidebar"
            aria-label="Open sidebar"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Global Search / Command Palette Trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-8 w-56 justify-start gap-2 text-muted-foreground sm:flex"
            onClick={() => window.dispatchEvent(new Event('app:open-command-palette'))}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="pointer-events-none rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          {/* Mobile search */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Search (⌘K)"
            aria-label="Search"
            className="text-muted-foreground hover:text-foreground sm:hidden"
            onClick={() => window.dispatchEvent(new Event('app:open-command-palette'))}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Active Model Indicator */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden gap-1.5 text-muted-foreground hover:text-foreground lg:flex"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs">{process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax-M2.7'}</span>
          </Button>

          {/* New Chat */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="New chat (⌘N)"
            aria-label="New chat"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => window.dispatchEvent(new Event('app:new-chat'))}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* Theme Toggle (desktop) */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {/* User Avatar */}
          {user && (
            <button
              type="button"
              title={user.name || user.email}
              aria-label="User menu"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="h-[calc(100vh-3.5rem)] overflow-auto">{children}</main>
    </section>
  );
}
