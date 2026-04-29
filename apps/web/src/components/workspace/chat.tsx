'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Bot, Loader2, CheckCircle2, XCircle, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { agentApi, apiEndpoints, workspaceApi, toastApiError} from '@/lib/api';
import { usePersonaStore } from '@/store/persona';
import { useActiveSkillsStore } from '@/store/skills';

type ToolCall = {
  name: string;
  args: unknown;
};

type Message = {
  id: string;
  taskId: string;
  taskStatus: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string | null;
};

export default function WorkspaceChat({ workspaceId }: { workspaceId: string }) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{ path: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversations scoped to the current workspace.
  const { data: convosData } = useQuery({
    queryKey: ['agent-conversations', workspaceId],
    queryFn: async () => {
      const res = await agentApi.get('/agent/conversations', {
        params: { workspaceId },
      });
      return res.data.conversations as Conversation[];
    },
    enabled: Boolean(workspaceId),
  });

  const activeConversationId = convosData?.[0]?.id;

  // Fetch messages. Live updates come via SSE (see effect below); we keep a
  // long fallback poll only as a safety net in case an event is missed.
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['agent-messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return { messages: [] };
      const res = await agentApi.get(`/agent/conversations/${activeConversationId}/messages`);
      return res.data as { messages: Message[] };
    },
    enabled: !!activeConversationId,
  });

  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData]);

  // Subscribe to per-task SSE streams for any active task in this conversation.
  // The agent service closes the stream automatically once the task reaches a
  // terminal status, so we only need to track active tasks here.
  useEffect(() => {
    if (!activeConversationId) return;
    const activeTaskIds = Array.from(
      new Set(
        messages
          .filter((m) =>
            ['pending', 'executing', 'waiting_approval'].includes(m.taskStatus),
          )
          .map((m) => m.taskId),
      ),
    );
    if (activeTaskIds.length === 0) return;

    const sources: EventSource[] = [];
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: ['agent-messages', activeConversationId],
      });

    for (const tid of activeTaskIds) {
      const url = `${apiEndpoints.agent}/agent/tasks/${tid}/events`;
      const es = new EventSource(url, { withCredentials: true });
      es.addEventListener('task', invalidate);
      es.addEventListener('step', invalidate);
      es.onerror = () => es.close();
      sources.push(es);
    }
    return () => {
      for (const es of sources) es.close();
    };
  }, [messages, activeConversationId, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const personaId = usePersonaStore.getState().activePersonaId;
      const skillIds = useActiveSkillsStore.getState().activeSkillIds;
      const composed =
        attachments.length > 0
          ? `${content}\n\n${attachments.map((a) => `[Attached: ${a.path}]`).join('\n')}`
          : content;
      await agentApi.post('/agent/tasks', {
        workspaceId,
        input: composed,
        conversationId: activeConversationId,
        personaId: personaId ?? undefined,
        skillIds: skillIds.length > 0 ? skillIds : undefined,
      });
    },
    onSuccess: () => {
      // Invalidate queries so we fetch the new task and poll
      if (!activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['agent-messages', activeConversationId] });
      }
      setAttachments([]);
    },
    onError: (error) => {
      toastApiError(error, 'Failed to send message');
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({
      taskId,
      decision,
      reason,
    }: {
      taskId: string;
      decision: 'approve' | 'reject';
      reason?: string;
    }) => {
      await agentApi.post(`/agent/tasks/${taskId}/tool-approval`, { decision, reason });
    },
    onSuccess: (_, variables) => {
      toast.success(`Tool call ${variables.decision}d.`);
      queryClient.invalidateQueries({ queryKey: ['agent-messages', activeConversationId] });
    },
    onError: (error) => {
      toastApiError(error, 'Failed to submit approval');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || sendMutation.isPending) return;
    sendMutation.mutate(input);
    setInput('');
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (!workspaceId) {
      toast.error('Open a workspace before attaching files.');
      return;
    }
    setIsUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('path', `/chat-uploads/${Date.now()}-${file.name}`);
        const res = await workspaceApi.post(`/workspaces/${workspaceId}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const path = res.data?.path ?? `/chat-uploads/${file.name}`;
        setAttachments((prev) => [...prev, { path, name: file.name }]);
      }
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached.`);
    } catch (err) {
      toastApiError(err, 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center justify-between border-b border-border px-4 font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Agent Chat</span>
        <Bot className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoadingMessages && !messages.length ? (
          <div className="flex h-full items-center justify-center text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <Loader2 className="motion-safe:animate-spin h-6 w-6 opacity-50" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4 shadow-sm">
              <Bot className="h-8 w-8 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium">How can I help you today?</p>
            <p className="text-xs mt-1 text-muted-foreground/60 text-center max-w-[200px]">
              Ask me to write code, run commands, or edit files in your workspace.
            </p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap transition-colors shadow-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground border border-border/50 rounded-bl-sm'
              }`}
            >
              {msg.content ||
                (msg.toolCalls?.length ? (
                  ''
                ) : (
                  <span className="italic text-muted-foreground">Processing...</span>
                ))}

              {/* Tool Calls Rendering */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Tool Calls</p>
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="rounded bg-background p-2 text-xs font-mono text-info"
                    >
                      <div>{tc.name}</div>
                      <div className="text-muted-foreground">{JSON.stringify(tc.args, null, 2)}</div>
                    </div>
                  ))}

                  {/* Approval UI */}
                  {msg.taskStatus === 'waiting_approval' && (
                    <div className="mt-2 flex space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() =>
                          approvalMutation.mutate({ taskId: msg.taskId, decision: 'approve' })
                        }
                        disabled={approvalMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() =>
                          approvalMutation.mutate({
                            taskId: msg.taskId,
                            decision: 'reject',
                            reason: 'User rejected manually',
                          })
                        }
                        disabled={approvalMutation.isPending}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center space-x-1 text-[10px] text-muted-foreground">
              <span>{msg.role === 'user' ? 'You' : 'Agent'}</span>
              {msg.taskStatus === 'executing' && (
                <Loader2 className="ml-1 h-3 w-3 motion-safe:animate-spin text-primary" />
              )}
              {msg.taskStatus === 'failed' && <span className="text-destructive">Failed</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
            {attachments.map((a, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-1 text-[11px] text-info border border-info/30"
                title={a.path}
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-info/20 transition-colors"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleFilePick}
            disabled={isUploading || sendMutation.isPending}
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Attach files"
            title="Attach files to message"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask agent to do something..."
            disabled={sendMutation.isPending}
            aria-label="Message agent"
            className="h-9 flex-1 bg-input border-none text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary transition-shadow"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9"
            disabled={(!input.trim() && attachments.length === 0) || sendMutation.isPending}
            aria-label={sendMutation.isPending ? 'Sending message' : 'Send message'}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
