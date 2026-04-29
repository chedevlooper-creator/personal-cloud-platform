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
    <section className="relative min-w-0 flex-1 bg-[#18191C] text-[#F0F0F0]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#303136] bg-[#1A1B1E] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Open sidebar"
            aria-label="Open sidebar"
            className="text-[#8E929A] hover:bg-[#25262A] hover:text-[#F0F0F0] md:hidden"
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
            className="hidden text-[#8E929A] hover:bg-[#25262A] hover:text-[#F0F0F0] md:inline-flex"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <h1 className="sr-only">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            title="New chat (Ctrl+N)"
            aria-label="New chat"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-[#E8E8E8] transition-colors hover:bg-[#25262A]"
            onClick={() => window.dispatchEvent(new Event('app:new-chat'))}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>
          <span className="h-1 w-1 rounded-full bg-[#F5A524]" aria-hidden="true" />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="h-[calc(100vh-3rem)] overflow-auto">
        {children}
      </main>
    </section>
  );
}
