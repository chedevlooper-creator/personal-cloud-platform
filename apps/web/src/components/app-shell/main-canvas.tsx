'use client';

import type React from 'react';
import { Menu, PanelLeft, Plus, MessageSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { cn } from '@/lib/utils';

type PageMeta = {
  title: string;
  section: string;
  showNewChat?: boolean;
};

const pageMeta: Record<string, PageMeta> = {
  '/dashboard': { title: 'Komut Merkezi', section: 'Zihinbulut', showNewChat: true },
  '/workspaces': { title: 'Çalışma Alanları', section: 'Üretim' },
  '/files': { title: 'Dosyalar', section: 'Üretim' },
  '/chats': { title: 'Sohbetler', section: 'Agent' },
  '/automations': { title: 'Otomasyonlar', section: 'Agent' },
  '/computer': { title: 'Bilgisayar', section: 'Sistem' },
  '/terminal': { title: 'Terminal', section: 'Sistem' },
  '/hosting': { title: 'Hosting', section: 'Yayınlama' },
  '/browser': { title: 'Tarayıcı', section: 'Sistem' },
  '/datasets': { title: 'Veri Setleri', section: 'Bilgi' },
  '/skills': { title: 'Yetenekler', section: 'Agent' },
  '/space': { title: 'Alan', section: 'Kaynaklar' },
  '/snapshots': { title: 'Anlık Görüntüler', section: 'Kaynaklar' },
  '/channels': { title: 'Kanallar', section: 'Bağlantılar' },
  '/apps': { title: 'Uygulamalar', section: 'Yayınlama' },
  '/bookmarks': { title: 'Yer İşaretleri', section: 'Üretim' },
  '/rules': { title: 'Kurallar', section: 'Agent' },
  '/personas': { title: 'Personalar', section: 'Agent' },
  '/audit-log': { title: 'Denetim Kaydı', section: 'Güvenlik' },
  '/admin': { title: 'Yönetim', section: 'Sistem' },
  '/settings': { title: 'Ayarlar', section: 'Hesap' },
};

function getPageMeta(pathname: string): PageMeta {
  if (pathname.startsWith('/workspace/')) {
    return { title: 'Çalışma Alanı', section: 'Üretim', showNewChat: true };
  }

  const exact = pageMeta[pathname];
  if (exact) return exact;

  const match = Object.entries(pageMeta)
    .filter(([path]) => path !== '/dashboard' && pathname.startsWith(path))
    .sort(([a], [b]) => b.length - a.length)[0];

  return match?.[1] ?? { title: 'Komut Merkezi', section: 'Zihinbulut', showNewChat: true };
}

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
  const meta = getPageMeta(pathname);
  const { isOpen, togglePanel } = useChatPanel();

  return (
    <section className="relative min-w-0 flex-1 bg-background text-foreground">
      <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur-md md:min-h-12">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon-touch"
            variant="ghost"
            title="Menüyü aç"
            aria-label="Menüyü aç"
            className="text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title={sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-label={sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className="hidden text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium uppercase text-muted-foreground">
              {meta.section}
            </div>
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {meta.title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {meta.showNewChat && (
            <Button
              type="button"
              title="Yeni sohbet (Ctrl+N)"
              aria-label="Yeni sohbet"
              size="touch"
              variant="ghost"
              className="min-w-11 gap-1.5 text-foreground md:h-8 md:min-w-0 md:px-2"
              onClick={() => window.dispatchEvent(new Event('app:new-chat'))}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Yeni sohbet</span>
            </Button>
          )}
          <Button
            type="button"
            title="Sohbet panelini aç/kapat"
            aria-label="Sohbet panelini aç/kapat"
            size="icon-sm"
            variant="ghost"
            className={cn(
              'hidden text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex',
              isOpen && 'text-primary',
            )}
            onClick={togglePanel}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="h-[calc(100dvh-3.5rem)] overflow-auto md:h-[calc(100dvh-3rem)]">
        {children}
      </main>
    </section>
  );
}
