'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Square,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { agentApi, workspaceApi , toastApiError} from '@/lib/api';
import { useUser } from '@/lib/auth';
import { usePersonaStore } from '@/store/persona';
import { useActiveSkillsStore } from '@/store/skills';
import { ChatContextBar } from '@/components/workspace/chat-context-bar';
import { cn } from '@/lib/utils';

type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
  toolCalls?: ToolCallInfo[];
};

type ToolCallInfo = {
  id: string;
  name: string;
  arguments: string;
  result: string | null;
  status: string;
};

type TaskResponse = {
  id: string;
  status: string;
  conversationId?: string;
};

export default function ChatsPage() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const convosQuery = useQuery({
    queryKey: ['conversations', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await agentApi.get('/agent/conversations');
      return (res.data?.conversations ?? res.data ?? []) as Conversation[];
    },
  });

  // Fetch messages for selected conversation
  const messagesQuery = useQuery({
    queryKey: ['messages', selectedConvoId],
    enabled: Boolean(selectedConvoId),
    queryFn: async () => {
      const res = await agentApi.get(`/agent/conversations/${selectedConvoId}/messages`);
      return (res.data?.messages ?? res.data ?? []) as Message[];
    },
  });

  const conversations = convosQuery.data ?? [];
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (prompt: string) => {
      setIsStreaming(true);
      // Get workspace ID
      const wsRes = await workspaceApi.get('/workspaces');
      const workspaces = wsRes.data?.workspaces ?? [];
      const workspaceId = workspaces[0]?.id;

      if (!workspaceId || !user?.id) throw new Error('No workspace or user');

      const personaId = usePersonaStore.getState().activePersonaId;
      const skillIds = useActiveSkillsStore.getState().activeSkillIds;

      const res = await agentApi.post('/agent/tasks', {
        workspaceId,
        conversationId: selectedConvoId || undefined,
        input: prompt,
        personaId: personaId ?? undefined,
        skillIds: skillIds.length > 0 ? skillIds : undefined,
      });
      return res.data as TaskResponse;
    },
    onSuccess: (data) => {
      setInput('');
      // Poll for completion
      pollTask(data.id);
    },
    onError: (err) => {
      setIsStreaming(false);
      toastApiError(err, 'Failed to send message');
    },
  });

  const pollTask = useCallback(async (taskId: string) => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await agentApi.get(`/agent/tasks/${taskId}`);
        const status = res.data?.status;
        if (status === 'completed' || status === 'failed') {
          setIsStreaming(false);
          // Refresh conversations and messages
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          if (selectedConvoId) {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConvoId] });
          }
          // If new conversation was created, select it
          if (res.data?.conversationId && !selectedConvoId) {
            setSelectedConvoId(res.data.conversationId);
          }
          break;
        }
      } catch {
        // Continue polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setIsStreaming(false);
  }, [queryClient, selectedConvoId]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt || isStreaming) return;
    sendMutation.mutate(prompt);
  };

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="hidden w-72 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-medium text-foreground">Conversations</span>
          <Button
            size="icon-xs"
            variant="ghost"
            title="New conversation"
            aria-label="New conversation"
            onClick={() => setSelectedConvoId(null)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {convosQuery.isLoading ? (
            <div className="p-3"><LoadingSkeleton lines={4} /></div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">No conversations yet</p>
          ) : (
            <ul className="space-y-0.5 p-1.5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedConvoId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedConvoId(c.id);
                      }
                    }}
                    className={cn(
                      'group flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedConvoId === c.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title || 'Untitled'}</span>
                    <button
                      type="button"
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      className="ml-2 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-6">
          {!selectedConvoId && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={<MessageCircle className="h-6 w-6" />}
                title="Start a conversation"
                description="Send a message to your AI assistant. It can read/write files, run commands, and more."
              />
            </div>
          ) : messagesQuery.isLoading ? (
            <LoadingSkeleton lines={8} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}>
                  {msg.role !== 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-4 py-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {/* Tool calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.toolCalls.map((tc) => (
                          <div key={tc.id} className="rounded-lg border border-border bg-background p-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium text-foreground">{tc.name}</span>
                              <StatusBadge variant={tc.status === 'completed' ? 'success' : tc.status === 'failed' ? 'error' : 'pending'}>
                                {tc.status}
                              </StatusBadge>
                            </div>
                            {tc.result && (
                              <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-1.5 text-[10px] text-muted-foreground">
                                {tc.result.slice(0, 500)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI is thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-background p-4">
          <div className="mx-auto max-w-3xl space-y-2">
            <ChatContextBar />
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Send a message..."
                rows={1}
                className="min-h-[44px] max-h-36 flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Chat message input"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                title={isStreaming ? 'Stop' : 'Send message'}
                aria-label={isStreaming ? 'Stop' : 'Send message'}
              >
                {isStreaming ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete conversation"
        description="This will permanently delete this conversation and all its messages."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await agentApi.delete(`/agent/conversations/${deleteTarget}`);
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            if (selectedConvoId === deleteTarget) setSelectedConvoId(null);
            toast.success('Conversation deleted');
          } catch (err) {
            toastApiError(err, 'Failed to delete');
          }
        }}
      />
    </div>
  );
}
