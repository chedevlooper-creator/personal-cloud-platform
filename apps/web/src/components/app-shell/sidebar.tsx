'use client';

import { useState } from 'react';
import {
  Boxes,
  ChevronDown,
  Clock3,
  Database,
  Folder,
  Globe,
  Globe2,
  Home,
  LayoutGrid,
  MessagesSquare,
  MoreHorizontal,
  Plug,
  Search,
  Settings,
  Sparkles,
  SquareTerminal,
  X,
  BrainCircuit,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { SidebarItem } from '@/components/app-shell/sidebar-item';
import { WorkspaceAccountCard } from '@/components/app-shell/workspace-account-card';

const primaryItems = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Files', href: '/files', icon: Folder, searchable: true },
  { label: 'Chats', href: '/chats', icon: MessagesSquare },
  { label: 'Automations', href: '/automations', icon: Clock3 },
  { label: 'Space', href: '/space', icon: LayoutGrid },
  { label: 'Skills', href: '/skills', icon: Sparkles },
  { label: 'Computer', href: '/computer', icon: SquareTerminal },
];

const moreItems = [
  { label: 'Terminal', href: '/terminal', icon: SquareTerminal },
  { label: 'Hosting', href: '/hosting', icon: Globe2 },
  { label: 'Datasets', href: '/datasets', icon: Database, badge: 'Beta' as const },
  { label: 'Browser', href: '/browser', icon: Globe },
  { label: 'Apps', href: '/apps', icon: Boxes },
  { label: 'Channels', href: '/channels', icon: Plug },
];

const secondaryItems = [{ label: 'Settings', href: '/settings', icon: Settings }];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard' && pathname === '/dashboard') return true;
  if (href !== '/dashboard' && pathname.startsWith(href)) return true;
  return false;
}

export function Sidebar({
  user,
  collapsed,
  mobileOpen,
  onMobileOpenChange,
}: {
  user?: AuthUser;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(true);

  const sidebarContent = (
    <aside
      className={cn(
        'relative flex h-full flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[56px]' : 'w-[220px]',
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-border/50">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              Zihinbulut
            </span>
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="Close menu"
          aria-label="Close menu"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          onClick={() => onMobileOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-auto px-1 pb-2">
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
                    className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
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

        <div className="mt-0.5">
          <button
            type="button"
            title="More"
            aria-label="Toggle more navigation"
            aria-expanded={moreOpen}
            aria-controls="sidebar-more-section"
            className={cn(
              'group flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-sidebar-foreground',
              collapsed && 'mx-auto w-8 justify-center px-0',
            )}
            onClick={() => setMoreOpen((value) => !value)}
          >
            {collapsed ? (
              <MoreHorizontal className="h-[17px] w-[17px]" />
            ) : (
              <>
                <span>More</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform',
                    !moreOpen && '-rotate-90',
                  )}
                />
              </>
            )}
          </button>
          {moreOpen && (
            <div id="sidebar-more-section" className="mt-0.5 space-y-0.5">
              {moreItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                  active={isActive(pathname, item.href)}
                  badge={item.badge}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-border/50 pt-2 space-y-0.5">
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-sidebar to-transparent" />

      <div className="relative z-10 border-t border-border/50 p-2 bg-sidebar">
        {!collapsed && (
          <div className="mb-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Share Zo, earn rewards</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </div>
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
          <div className="relative h-full w-[200px] max-w-[88vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
