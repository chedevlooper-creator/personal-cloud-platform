'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, X, Plus } from 'lucide-react';
import { ChatCore } from '@/components/chat/chat-core';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { workspaceApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type WorkspaceSummary = {
  id: string;
  name: string;
};

export function GlobalChatPanel() {
  const {
    isOpen,
    activeConversationId,
    activeWorkspaceId,
    togglePanel,
    setActiveConversationId,
    setActiveWorkspaceId,
    startNewChat,
  } = useChatPanel();

  const { data: workspacesData } = useQuery({
    queryKey: ['chat-workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return (res.data?.workspaces ?? []) as WorkspaceSummary[];
    },
    enabled: isOpen && !activeWorkspaceId,
    staleTime: 30_000,
  });

  const fallbackWorkspaceId = useMemo(() => workspacesData?.[0]?.id ?? null, [workspacesData]);
  const effectiveWorkspaceId = activeWorkspaceId ?? fallbackWorkspaceId;

  useEffect(() => {
    if (!activeWorkspaceId && fallbackWorkspaceId) {
      setActiveWorkspaceId(fallbackWorkspaceId);
    }
  }, [activeWorkspaceId, fallbackWorkspaceId, setActiveWorkspaceId]);

  return (
    <>
      {/* Desktop: Fixed Panel */}
      <div className={cn('hidden md:block h-full shrink-0', !isOpen && 'hidden')}>
        {isOpen && (
          <div className="relative flex h-full w-[420px] flex-col border-l border-border bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 animate-fade-in-soft">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(120%_70%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]"
            />
            <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-6 w-6 items-center justify-center rounded-md bg-primary/12 text-primary">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_60%,transparent)] animate-slow-pulse" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Sohbet
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Yeni sohbet"
                  aria-label="Yeni sohbet"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePanel}
                  className="press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Paneli kapat"
                  aria-label="Paneli kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <ChatCore
                conversationId={activeConversationId}
                workspaceId={effectiveWorkspaceId}
                onConversationChange={setActiveConversationId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Fixed overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden animate-fade-in-soft">
          <div className="flex h-12 items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-xl px-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-primary">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">Sohbet</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startNewChat}
                className="press flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={togglePanel}
                className="press flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ChatCore
              conversationId={activeConversationId}
              workspaceId={effectiveWorkspaceId}
              onConversationChange={setActiveConversationId}
            />
          </div>
        </div>
      )}
    </>
  );
}
