'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Bot,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { agentApi, toastApiError } from '@/lib/api';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

type Conversation = {
  id: string;
  workspaceId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

function groupConversations(convos: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Bugün', items: [] },
    { label: 'Dün', items: [] },
    { label: 'Son 7 gün', items: [] },
    { label: 'Daha eski', items: [] },
  ];

  for (const c of convos) {
    const d = new Date(c.updatedAt);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= last7) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ChatsPage() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversationId, setActiveWorkspaceId, startNewChat } =
    useChatPanel();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await agentApi.get('/agent/conversations');
      return (res.data?.conversations ?? res.data ?? []) as Conversation[];
    },
  });

  const conversations = data ?? [];
  const filtered = search
    ? conversations.filter(
        (c) =>
          (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
          c.id.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  const grouped = groupConversations(filtered);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/agent/conversations/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
      toast.success('Sohbet silindi');
    },
    onError: (err) => toastApiError(err, 'Silinemedi'),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await agentApi.patch(`/agent/conversations/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditingId(null);
      toast.success('Yeniden adlandırıldı');
    },
    onError: (err) => toastApiError(err, 'Adlandırılamadı'),
  });

  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setEditValue(c.title ?? '');
  };

  const saveRename = (id: string) => {
    if (editValue.trim()) {
      renameMutation.mutate({ id, title: editValue.trim() });
    } else {
      setEditingId(null);
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border/60 bg-card/60 backdrop-blur-md">
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">Sohbetler</span>
          <button
            type="button"
            title="Yeni sohbet"
            aria-label="Yeni sohbet"
            onClick={startNewChat}
            className="press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border/60 p-2">
          <div className="group/search flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_15%,transparent)]">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sohbetlerde ara..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto scroll-elegant p-1.5">
          {isLoading ? (
            <div className="p-3">
              <LoadingSkeleton lines={6} />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Sonuç bulunamadı' : 'Henüz sohbet yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((c) => {
                      const isActive = activeConversationId === c.id;
                      const isEditing = editingId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setActiveConversationId(c.id);
                            setActiveWorkspaceId(c.workspaceId);
                          }}
                          className={cn(
                            'group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-[background-color,color,transform] duration-200 active:scale-[0.99]',
                            isActive
                              ? 'bg-primary/12 text-primary shadow-[inset_2px_0_0_0_var(--primary)]'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {isEditing ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename(c.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="min-w-0 flex-1 rounded bg-background px-2 py-1 text-xs text-foreground outline-none ring-1 ring-primary"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveRename(c.id);
                                }}
                                className="rounded p-1 text-success hover:bg-success/10"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(null);
                                }}
                                className="rounded p-1 text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="min-w-0 flex-1 truncate">{c.title || 'İsimsiz'}</span>
                              <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startRename(c);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Yeniden adlandır"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(c.id);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="Sil"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side is empty because global chat panel handles the chat */}
      <div className="hidden flex-1 items-center justify-center text-muted-foreground md:flex">
        <EmptyState
          icon={<Bot className="h-8 w-8" />}
          title="Sohbet seçin veya yeni başlayın"
          description="Sol panelden bir sohbet seçin veya sağ panelden yeni sohbet başlatın."
        />
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Sohbeti sil"
        description="Bu sohbet ve tüm mesajları kalıcı olarak silinecek."
        confirmLabel="Sil"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
