'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Paperclip,
  Loader2,
  Bot,
  User,
  Check,
  Copy,
  X,
  Square,
  RotateCcw,
  Pencil,
  ImageIcon,
  FileText,
  FileCode,
  File,
  FileSpreadsheet,
  FileType,
  ChevronDown,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentApi, apiEndpoints, workspaceApi, toastApiError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { usePersonaStore } from '@/store/persona';
import { useActiveSkillsStore } from '@/store/skills';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/app-shell/markdown';
import { ModelSelector } from '@/components/app-shell/model-selector';
import { PersonaSelector } from '@/components/app-shell/persona-selector';
import { StatusBadge } from '@/components/ui/status-badge';
import { useChatPanel } from '@/components/chat/chat-panel-context';

type ToolCallInfo = {
  id: string;
  name: string;
  arguments: string;
  result: string | null;
  status: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
  taskId: string;
  taskStatus: string;
  toolCalls?: ToolCallInfo[];
};

type Attachment = {
  path: string;
  name: string;
  size?: number;
  type?: string;
  preview?: string;
  uploading?: boolean;
  uploadProgress?: number;
};

function FileIconRenderer({ filename, className }: { filename: string; className?: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconClass = className ?? 'h-4 w-4 shrink-0 text-muted-foreground';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext ?? ''))
    return <ImageIcon className={iconClass} />;
  if (['pdf'].includes(ext ?? '')) return <FileText className={iconClass} />;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb'].includes(ext ?? ''))
    return <FileCode className={iconClass} />;
  if (['xls', 'xlsx', 'csv'].includes(ext ?? '')) return <FileSpreadsheet className={iconClass} />;
  if (['doc', 'docx', 'txt', 'md'].includes(ext ?? '')) return <FileType className={iconClass} />;
  return <File className={iconClass} />;
}

function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext ?? '');
}

export function ChatCore({
  conversationId,
  workspaceId,
  onConversationChange,
}: {
  conversationId: string | null;
  workspaceId?: string | null;
  onConversationChange?: (id: string | null) => void;
}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { setIsOpen } = useChatPanel();
  const isNearBottomRef = useRef(true);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['agent-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await agentApi.get(`/agent/conversations/${conversationId}/messages`);
      return (res.data?.messages ?? res.data ?? []) as Message[];
    },
  });

  const messages = useMemo(() => messagesData ?? [], [messagesData]);

  // Listen for workspace file attachments from file tree
  useEffect(() => {
    const handleAttachFile = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        path: string;
        name: string;
        size?: number;
        type?: string;
      };
      if (!detail) return;
      setAttachments((prev) => {
        if (prev.some((a) => a.path === detail.path)) return prev;
        return [...prev, { path: detail.path, name: detail.name, size: detail.size, type: detail.type }];
      });
      setIsOpen(true);
    };
    window.addEventListener('app:attach-file-to-chat', handleAttachFile);
    return () => window.removeEventListener('app:attach-file-to-chat', handleAttachFile);
  }, [setIsOpen]);

  // Scroll detection
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100; // px from bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      isNearBottomRef.current = isNearBottom;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  // Auto-scroll only if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Subscribe to SSE for active tasks
  useEffect(() => {
    if (!conversationId) return;
    const activeTaskIds = Array.from(
      new Set(
        messages
          .filter((m) => ['pending', 'executing', 'waiting_approval'].includes(m.taskStatus))
          .map((m) => m.taskId),
      ),
    );
    if (activeTaskIds.length === 0) return;

    const sources: EventSource[] = [];
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ['agent-messages', conversationId] });

    for (const tid of activeTaskIds) {
      const url = `${apiEndpoints.agent}/agent/tasks/${tid}/events`;
      const es = new EventSource(url, { withCredentials: true });
      es.addEventListener('step', invalidate);
      es.addEventListener('task', (ev: MessageEvent) => {
        invalidate();
        try {
          const payload = JSON.parse(ev.data) as { status?: string; conversationId?: string | null };
          if (payload.status && ['completed', 'failed', 'cancelled'].includes(payload.status)) {
            setIsStreaming(false);
            es.close();
          }
        } catch {
          // ignore
        }
      });
      es.onerror = () => {
        setIsStreaming(false);
        es.close();
      };
      sources.push(es);
    }
    return () => {
      for (const es of sources) es.close();
    };
  }, [messages, conversationId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsStreaming(true);
      const personaId = usePersonaStore.getState().activePersonaId;
      const skillIds = useActiveSkillsStore.getState().activeSkillIds;
      const composed =
        attachments.length > 0
          ? `${content}\n\n${attachments.map((a) => `[Attached: ${a.path}]`).join('\n')}`
          : content;

      const res = await agentApi.post('/agent/tasks', {
        workspaceId: workspaceId ?? undefined,
        conversationId: conversationId || undefined,
        input: composed,
        personaId: personaId ?? undefined,
        skillIds: skillIds.length > 0 ? skillIds : undefined,
      });
      return res.data as { id: string; conversationId?: string | null };
    },
    onSuccess: (data) => {
      setInput('');
      setAttachments([]);
      if (data.conversationId && data.conversationId !== conversationId) {
        onConversationChange?.(data.conversationId);
      }
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['agent-messages', conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => {
      setIsStreaming(false);
      toastApiError(err, 'Mesaj gönderilemedi');
    },
  });

  const handleSend = useCallback(() => {
    const prompt = input.trim();
    if ((!prompt && attachments.length === 0) || sendMutation.isPending) return;
    sendMutation.mutate(prompt);
  }, [input, attachments.length, sendMutation]);

  const handleFilePick = useCallback(() => fileInputRef.current?.click(), []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!workspaceId) {
        toast.error('Dosya yüklemek için bir çalışma alanına ihtiyaç var.');
        return null;
      }

      const tempAttachment: Attachment = {
        path: `/chat-uploads/${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploading: true,
        uploadProgress: 0,
      };

      // Create preview for images
      if (isImageFile(file.name)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) =>
            prev.map((a) => (a.path === tempAttachment.path ? { ...a, preview: e.target?.result as string } : a)),
          );
        };
        reader.readAsDataURL(file);
      }

      setAttachments((prev) => [...prev, tempAttachment]);

      try {
        const form = new FormData();
        form.append('file', file);
        form.append('path', tempAttachment.path);
        const res = await workspaceApi.post(`/workspaces/${workspaceId}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setAttachments((prev) =>
                prev.map((a) => (a.path === tempAttachment.path ? { ...a, uploadProgress: progress } : a)),
              );
            }
          },
        });

        const path = res.data?.path ?? tempAttachment.path;
        setAttachments((prev) =>
          prev.map((a) => (a.path === tempAttachment.path ? { ...a, path, uploading: false, uploadProgress: 100 } : a)),
        );
        return path;
      } catch (err) {
        toastApiError(err, `"${file.name}" yüklenemedi`);
        setAttachments((prev) => prev.filter((a) => a.path !== tempAttachment.path));
        return null;
      }
    },
    [workspaceId],
  );

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;

      const results = await Promise.all(files.map((f) => uploadFile(f)));
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        toast.success(`${successCount} dosya eklendi.`);
      }
    },
    [uploadFile],
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // Check for workspace files (from file tree drag)
      const workspaceFileData = e.dataTransfer.getData('application/x-workspace-file');
      if (workspaceFileData) {
        try {
          const fileInfo = JSON.parse(workspaceFileData) as {
            path: string;
            name: string;
            size: number;
            workspaceId: string;
          };
          setAttachments((prev) => {
            if (prev.some((a) => a.path === fileInfo.path)) return prev;
            return [...prev, { path: fileInfo.path, name: fileInfo.name, size: fileInfo.size }];
          });
          toast.success(`"${fileInfo.name}" eklendi`);
          return;
        } catch {
          // ignore parse error
        }
      }

      // Regular file drop
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const results = await Promise.all(files.map((f) => uploadFile(f)));
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        toast.success(`${successCount} dosya eklendi.`);
      }
    },
    [uploadFile],
  );

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }, []);

  const stopGeneration = useCallback(() => {
    setIsStreaming(false);
  }, []);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agent
          </span>
        </div>
        {isStreaming && (
          <button
            type="button"
            onClick={stopGeneration}
            className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20"
          >
            <Square className="h-3 w-3" /> Durdur
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto p-3 space-y-4',
          isDragOver && 'bg-primary/5 ring-2 ring-primary/20 ring-inset',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/5">
            <div className="rounded-xl bg-card p-6 text-center shadow-lg ring-1 ring-border">
              <Paperclip className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-foreground">Dosyaları buraya bırakın</p>
              <p className="text-xs text-muted-foreground">Resim, PDF, kod dosyaları ve daha fazlası</p>
            </div>
          </div>
        )}

        {!conversationId && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3">
              <Bot className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium">Bugün ne yapalım?</p>
            <p className="text-xs mt-1 text-muted-foreground/60 text-center max-w-[200px]">
              Kod yazdırın, komut çalıştırın veya çalışma alanındaki dosyaları düzenletin.
            </p>
            <p className="text-xs mt-2 text-muted-foreground/40 text-center">
              Dosyaları sürükleyip bırakarak da ekleyebilirsiniz.
            </p>
          </div>
        ) : isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={idx === messages.length - 1}
            onEdit={(content) => {
              setInput(content);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            onRegenerate={() => {
              if (msg.role === 'user') {
                sendMutation.mutate(msg.content);
              } else {
                for (let i = idx - 1; i >= 0; i--) {
                  if (messages[i]?.role === 'user') {
                    sendMutation.mutate(messages[i].content);
                    break;
                  }
                }
              }
            }}
          />
        ))}

        {isStreaming && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            type="button"
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              isNearBottomRef.current = true;
              setShowScrollButton(false);
            }}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            En alta git
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.path}
                attachment={a}
                onRemove={() => removeAttachment(a.path)}
              />
            ))}
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={handleFilePick}
              disabled={attachments.some((a) => a.uploading) || sendMutation.isPending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Dosya ekle"
              title="Dosya ekle (sürükleyip bırakabilirsiniz)"
            >
              {attachments.some((a) => a.uploading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={workspaceId ? "Agent'a görev ver..." : 'Dosya yüklemek için çalışma alanına gidin'}
              rows={1}
              disabled={sendMutation.isPending || !workspaceId}
              className="min-h-[36px] max-h-24 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Chat message input"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || sendMutation.isPending || !workspaceId}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              aria-label="Mesaj gönder"
              title="Mesaj gönder"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 px-1">
            <PersonaSelector compact />
            <ModelSelector compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const isImage = isImageFile(attachment.name);

  return (
    <div className="group relative flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs">
      {isImage && attachment.preview ? (
        <img src={attachment.preview} alt={attachment.name} className="h-8 w-8 rounded object-cover" />
      ) : (
        <FileIconRenderer filename={attachment.name} />
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground max-w-[120px]">{attachment.name}</p>
        {attachment.size !== undefined && (
          <p className="text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</p>
        )}
      </div>

      {attachment.uploading ? (
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${attachment.uploadProgress ?? 0}%` }}
            />
          </div>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label={`${attachment.name} ekini kaldır`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isLast: _isLast,
  onEdit,
  onRegenerate,
}: {
  message: Message;
  isLast?: boolean;
  onEdit?: (content: string) => void;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  // Parse attached files from message content
  const attachedFiles = useMemo(() => {
    const matches = message.content.match(/\[Attached: ([^\]]+)\]/g);
    if (!matches) return [];
    return matches.map((m) => m.replace('[Attached: ', '').replace(']', ''));
  }, [message.content]);

  // Clean content without attachment markers
  const cleanContent = useMemo(() => {
    return message.content.replace(/\n\n\[Attached: [^\]]+\]/g, '').replace(/\[Attached: [^\]]+\]/g, '');
  }, [message.content]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className={cn(
        'group flex w-full gap-2.5',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn('flex max-w-[85%] flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative break-words rounded-2xl px-4 py-2.5 text-sm leading-[1.7]',
            isUser
              ? 'rounded-tr-md bg-primary text-primary-foreground'
              : 'rounded-tl-md bg-muted text-foreground ring-1 ring-border/60',
          )}
        >
          {/* Attached files display */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {attachedFiles.map((filePath, idx) => {
                const filename = filePath.split('/').pop() ?? filePath;
                const isImg = isImageFile(filename);
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2',
                      isUser && 'bg-white/10 border-white/10',
                    )}
                  >
                    {isImg ? (
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        <img
                          src={`${process.env.NEXT_PUBLIC_WORKSPACE_API_URL || 'http://localhost:3002/api'}/files${filePath}`}
                          alt={filename}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <FileIconRenderer filename={filename} className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{filename}</p>
                      <p className="text-[10px] text-muted-foreground">{filePath}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cleanContent ? (
            isUser ? (
              <span className="whitespace-pre-wrap">{cleanContent}</span>
            ) : (
              <Markdown text={cleanContent} />
            )
          ) : message.toolCalls && message.toolCalls.length > 0 ? null : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:140ms]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:280ms]" />
            </span>
          )}

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
              {message.toolCalls.map((tc) => (
                <div key={tc.id} className="rounded-lg border border-border bg-background p-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{tc.name}</span>
                    <StatusBadge
                      variant={
                        tc.status === 'completed'
                          ? 'success'
                          : tc.status === 'failed'
                            ? 'error'
                            : 'pending'
                      }
                    >
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

        {/* Message Actions */}
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isUser && message.content && (
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Kopyala
                </>
              )}
            </button>
          )}

          {isUser && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message.content)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Düzenle
            </button>
          )}

          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Yeniden üret
            </button>
          )}
        </div>
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-3 ring-1 ring-border/60" role="status" aria-live="polite">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:140ms]" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:280ms]" />
        </div>
      </div>
    </div>
  );
}
