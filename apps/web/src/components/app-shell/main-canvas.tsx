'use client';

import type React from 'react';
import { Menu, PanelLeft, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

const titles: Record<string, string> = {
  '/dashboard': 'Home',
  '/files': 'Files',
  '/chats': 'Chats',
  '/automations': 'Automations',
  '/terminal': 'Terminal',
  '/hosting': 'Hosting',
  '/snapshots': 'Snapshots',
  '/settings': 'Settings',
};

export function MainCanvas({
  children,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSidebar,
}: {
  children: React.ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSidebar: () => void;
}) {
  const pathname = usePathname();
  const title = titles[pathname] || (pathname.startsWith('/workspace') ? 'Workspace' : 'Home');

  return (
    <section className="relative min-w-0 flex-1 bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Open sidebar"
            aria-label="Open sidebar"
            className="text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            title="New chat (Ctrl+N)"
            aria-label="New chat"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            onClick={() => window.dispatchEvent(new Event('app:new-chat'))}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="h-[calc(100dvh-3rem)] overflow-auto">
        {children}
      </main>
    </section>
  );
}
