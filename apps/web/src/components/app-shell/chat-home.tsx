'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatComposer } from '@/components/app-shell/chat-composer';
import { ChatMessages, type ChatMessage } from '@/components/app-shell/chat-messages';
import { DottedBackground } from '@/components/app-shell/dotted-background';
import { StatusToast } from '@/components/app-shell/status-toast';
import { ToolApproval } from '@/components/app-shell/tool-approval-card';
import { agentApi, getApiErrorMessage } from '@/lib/api';

export function ChatHome() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [toolApproval, setToolApproval] = useState<ToolApproval | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearStreamTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearStreamTimer();
    setMessages((current) =>
      current.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
    setIsThinking(false);
  }, [clearStreamTimer]);

  const startNewChat = useCallback(() => {
    stopGeneration();
    setMessages([]);
    setInput('');
    setToolApproval(null);
  }, [stopGeneration]);

  const openUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    const handleNewChat = () => startNewChat();
    const handleUpload = () => openUpload();
    window.addEventListener('app:new-chat', handleNewChat);
    window.addEventListener('app:open-file-upload', handleUpload);
    return () => {
      window.removeEventListener('app:new-chat', handleNewChat);
      window.removeEventListener('app:open-file-upload', handleUpload);
    };
  }, [openUpload, startNewChat]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isThinking) {
        stopGeneration();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isThinking, stopGeneration]);

  useEffect(() => {
    return () => stopGeneration();
  }, [stopGeneration]);

  const submit = async () => {
    const prompt = input.trim();
    if (!prompt || isThinking) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: prompt },
    ]);
    setInput('');
    setIsThinking(true);
    setToolApproval(null);

    // Note: the dashboard chat uses the lightweight `/agent/chat` endpoint,
    // which does not run tools and therefore has no approval flow. Real
    // tool-approval lives in the workspace chat, wired against the
    // task SSE stream and `/agent/tasks/:id/tool-approval`.

    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await agentApi.post(
        '/agent/chat',
        { input: prompt },
        { signal: controller.signal },
      );
      const content =
        (response.data as { content?: string }).content ||
        'I did not receive a response from the model.';

      // Word-by-word reveal for a streaming feel.
      setMessages((current) => [
        ...current,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);
      const tokens = content.split(/(\s+)/);
      // Reveal speed: shorter delay + larger chunks for snappier feel,
      // with the chunk size scaled to the response length so very long
      // responses don't feel laggy.
      const stepSize = Math.max(2, Math.min(8, Math.ceil(tokens.length / 120)));
      const intervalMs = 12;
      let i = 0;
      clearStreamTimer();
      intervalRef.current = setInterval(() => {
        if (controller.signal.aborted) {
          clearStreamTimer();
          return;
        }
        const chunk = tokens.slice(0, i + stepSize).join('');
        i += stepSize;
        setMessages((current) =>
          current.map((m) => (m.id === assistantId ? { ...m, content: chunk } : m)),
        );
        if (i >= tokens.length) {
          clearStreamTimer();
          setMessages((current) =>
            current.map((m) =>
              m.id === assistantId ? { ...m, content, streaming: false } : m,
            ),
          );
        }
      }, intervalMs);
    } catch (error) {
      const content = controller.signal.aborted
        ? 'Generation stopped.'
        : getApiErrorMessage(error, 'The MiniMax agent service is not available.');
      setMessages((current) => {
        if (current.some((m) => m.id === assistantId)) {
          return current.map((m) => (m.id === assistantId ? { ...m, content, streaming: false } : m));
        }
        return [...current, { id: assistantId, role: 'assistant', content }];
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsThinking(false);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Decorative background elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-56 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_68%)] opacity-[0.05] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -top-72 hidden h-[1000px] w-[1000px] rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_68%)] opacity-[0.08] blur-3xl sm:block animate-aurora"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-280px] left-[22%] h-[560px] w-[820px] rounded-full bg-[radial-gradient(circle,var(--ring)_0%,transparent_70%)] opacity-[0.06] blur-3xl animate-aurora-slow"
      />
      
      <DottedBackground className="opacity-30" />
      <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload files" />
      <div
        className={`relative z-10 mx-auto flex w-[calc(100vw-3rem)] min-w-0 max-w-full flex-1 flex-col pb-20 pt-8 sm:w-full sm:max-w-[760px] ${
          messages.length === 0 ? 'justify-center lg:pt-[27vh]' : 'justify-start lg:pt-12'
        }`}
      >
        <StatusToast isThinking={isThinking} onStop={stopGeneration} />
        {messages.length > 0 && (
          <ChatMessages messages={messages} isThinking={isThinking} />
        )}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={submit}
          onUpload={openUpload}
          isThinking={isThinking}
          toolApproval={toolApproval}
          onApproveTool={() => setToolApproval(null)}
          onRejectTool={() => setToolApproval(null)}
        />
        <div className="mt-5 text-[10px] leading-tight text-[#777C85]">
          <div className="font-extrabold text-[#B1B3B9]">Rewards</div>
          <div>Earn $10 / user</div>
        </div>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[520px] flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-1 text-xs text-[#A8A8A8]/80">
        <span>kafkasder.zo.computer</span>
        <span>kafkasder.zo.space</span>
        <span>kafkasder@zo.computer</span>
      </div>
    </div>
  );
}
