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
  { label: 'Ana sayfa', href: '/dashboard', icon: Home },
  { label: 'Çalışma alanları', href: '/workspaces', icon: LayoutGrid },
  { label: 'Dosyalar', href: '/files', icon: Folder, searchable: true },
  { label: 'Sohbetler', href: '/chats', icon: MessagesSquare },
  { label: 'Otomasyonlar', href: '/automations', icon: Clock3 },
  { label: 'Bilgisayar', href: '/computer', icon: SquareTerminal },
];

const moreItems = [
  { label: 'Terminal', href: '/terminal', icon: SquareTerminal },
  { label: 'Hosting', href: '/hosting', icon: Globe2 },
  { label: 'Tarayıcı', href: '/browser', icon: Globe },
  { label: 'Veri setleri', href: '/datasets', icon: Database, badge: 'Beta' as const },
  { label: 'Yetenekler', href: '/skills', icon: Sparkles },
  { label: 'Alan', href: '/space', icon: LayoutGrid },
  { label: 'Uygulamalar', href: '/apps', icon: Boxes },
  { label: 'Kanallar', href: '/channels', icon: Plug },
];

const secondaryItems = [{ label: 'Ayarlar', href: '/settings', icon: Settings }];

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

  const renderSidebarContent = (isCollapsed: boolean) => (
    <aside
      className={cn(
        'relative flex h-full flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        isCollapsed ? 'w-[56px]' : 'w-[232px]',
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-border/50">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          </div>
          {!isCollapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              Zihinbulut
            </span>
          )}
        </div>
        <Button
          type="button"
          size="icon-touch"
          variant="ghost"
          title="Menüyü kapat"
          aria-label="Menüyü kapat"
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
              collapsed={isCollapsed}
              active={isActive(pathname, item.href)}
              action={
                item.searchable ? (
                  <button
                    type="button"
                    title="Dosyalarda ara"
                    aria-label="Dosyalarda ara"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            title="Sistem"
            aria-label="Sistem menüsünü aç veya kapat"
            aria-expanded={moreOpen}
            aria-controls="sidebar-more-section"
            className={cn(
              'group flex h-9 w-full items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-sidebar-foreground md:h-7',
              isCollapsed && 'mx-auto w-9 justify-center px-0 md:w-8',
            )}
            onClick={() => setMoreOpen((value) => !value)}
          >
            {isCollapsed ? (
              <MoreHorizontal className="h-[17px] w-[17px]" />
            ) : (
              <>
                <span>Sistem</span>
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
                  collapsed={isCollapsed}
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
              collapsed={isCollapsed}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-sidebar to-transparent" />

      <div className="relative z-10 border-t border-border/50 p-2 bg-sidebar">
        <WorkspaceAccountCard user={user} collapsed={isCollapsed} />
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden shrink-0 md:block">{renderSidebarContent(collapsed)}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menü kaplama alanını kapat"
            className="absolute inset-0 bg-black/60"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="relative h-full w-[232px] max-w-[88vw]">{renderSidebarContent(false)}</div>
        </div>
      )}
    </>
  );
}
