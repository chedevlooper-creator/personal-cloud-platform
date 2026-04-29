'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Bot, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { agentApi, toastApiError} from '@/lib/api';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: convosData } = useQuery({
    queryKey: ['agent-conversations'],
    queryFn: async () => {
      const res = await agentApi.get('/agent/conversations');
      return res.data.conversations as Conversation[];
    },
  });

  const activeConversationId = convosData?.[0]?.id;

  // Fetch messages
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['agent-messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return { messages: [] };
      const res = await agentApi.get(`/agent/conversations/${activeConversationId}/messages`);
      return res.data as { messages: Message[] };
    },
    enabled: !!activeConversationId,
    refetchInterval: (query) => {
      // Poll if any task is executing or waiting approval
      const isPending = query.state?.data?.messages.some((m: Message) =>
        ['pending', 'executing'].includes(m.taskStatus),
      );
      return isPending ? 2000 : false;
    },
  });

  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const personaId = usePersonaStore.getState().activePersonaId;
      const skillIds = useActiveSkillsStore.getState().activeSkillIds;
      await agentApi.post('/agent/tasks', {
        workspaceId,
        input: content,
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
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      <div className="flex h-10 items-center justify-between border-b border-[#333333] px-4 font-semibold uppercase tracking-wider text-zinc-400">
        <span>Agent Chat</span>
        <Bot className="h-5 w-5 text-blue-400" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages && !messages.length ? (
          <div className="flex justify-center text-zinc-500 py-4">
            <Loader2 className="animate-spin h-5 w-5" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500">
            <Bot className="mb-2 h-10 w-10 text-zinc-600" />
            <p>How can I help you today?</p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#37373d] text-zinc-200'
              }`}
            >
              {msg.content ||
                (msg.toolCalls?.length ? (
                  ''
                ) : (
                  <span className="italic text-zinc-400">Processing...</span>
                ))}

              {/* Tool Calls Rendering */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-[#4c4c4c] pt-2">
                  <p className="text-xs font-semibold uppercase text-zinc-400">Tool Calls</p>
                  {msg.toolCalls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="rounded bg-[#2d2d2d] p-2 text-xs font-mono text-blue-300"
                    >
                      <div>{tc.name}</div>
                      <div className="text-zinc-400">{JSON.stringify(tc.args, null, 2)}</div>
                    </div>
                  ))}

                  {/* Approval UI */}
                  {msg.taskStatus === 'waiting_approval' && (
                    <div className="mt-2 flex space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
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
            <div className="mt-1 flex items-center space-x-1 text-[10px] text-zinc-500">
              <span>{msg.role === 'user' ? 'You' : 'Agent'}</span>
              {msg.taskStatus === 'executing' && (
                <Loader2 className="ml-1 h-3 w-3 animate-spin text-blue-400" />
              )}
              {msg.taskStatus === 'failed' && <span className="text-red-400">Failed</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#333333] p-3">
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask agent to do something..."
            disabled={sendMutation.isPending}
            className="h-9 flex-1 bg-[#3c3c3c] border-none text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-blue-500"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 bg-blue-600 hover:bg-blue-500"
            disabled={!input.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
