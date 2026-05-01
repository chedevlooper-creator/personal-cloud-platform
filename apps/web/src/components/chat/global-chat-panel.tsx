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
          <div className="flex h-full w-[420px] flex-col border-l border-border bg-card">
            {/* Panel Header */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sohbet
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Yeni sohbet"
                  aria-label="Yeni sohbet"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePanel}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Paneli kapat"
                  aria-label="Paneli kapat"
                >
                  <X className="h-4 w-4" />
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
      </div>

      {/* Mobile: Fixed overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex h-12 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Sohbet</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startNewChat}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={togglePanel}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
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
