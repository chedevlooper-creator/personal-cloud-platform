'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatComposer } from '@/components/app-shell/chat-composer';
import { DottedBackground } from '@/components/app-shell/dotted-background';
import { StatusToast } from '@/components/app-shell/status-toast';
import { ToolApproval } from '@/components/app-shell/tool-approval-card';
import { agentApi, getApiErrorMessage } from '@/lib/api';

export function ChatHome() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  >([]);
  const [isThinking, setIsThinking] = useState(false);
  const [toolApproval, setToolApproval] = useState<ToolApproval | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsThinking(false);
  }, []);

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
    setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);

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

      setMessages((current) =>
        current.map((message) => (message.id === assistantId ? { ...message, content } : message)),
      );
    } catch (error) {
      const content = controller.signal.aborted
        ? 'Generation stopped.'
        : getApiErrorMessage(error, 'The MiniMax agent service is not available.');

      setMessages((current) =>
        current.map((message) => (message.id === assistantId ? { ...message, content } : message)),
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsThinking(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#1D1E21_0%,#18191C_100%)] px-4 pb-4 pt-8 text-[#F0F0F0] sm:px-8 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-56 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,#3FB6E0_0%,transparent_68%)] opacity-[0.10] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -top-72 h-[1000px] w-[1000px] rounded-full bg-[radial-gradient(circle,#B85CFF_0%,transparent_68%)] opacity-[0.12] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-280px] left-[22%] h-[560px] w-[820px] rounded-full bg-[radial-gradient(circle,#F5A524_0%,transparent_70%)] opacity-[0.09] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -left-48 h-[600px] w-[760px] rounded-full bg-[radial-gradient(circle,#7CD992_0%,transparent_70%)] opacity-[0.08] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-56 h-[1400px] w-96 -rotate-[22deg] rounded-full bg-[linear-gradient(90deg,transparent,#3FB6E0,transparent)] opacity-[0.07] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-32 -top-72 h-[1400px] w-80 rotate-[18deg] rounded-full bg-[linear-gradient(90deg,transparent,#B85CFF,transparent)] opacity-[0.06] blur-3xl"
      />
      <DottedBackground className="opacity-45" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[13%] top-[10%] h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_14px_4px_rgba(122,184,255,0.65)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[43%] top-[16%] h-1 w-1 rounded-full bg-[#FFE7B3] shadow-[0_0_18px_5px_rgba(245,165,36,0.55)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[22%] top-[11%] h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_14px_4px_rgba(184,92,255,0.55)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[15%] bottom-[18%] h-1 w-1 rounded-full bg-[#FFE7B3] shadow-[0_0_16px_4px_rgba(245,165,36,0.5)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[2%] top-[25%] h-px w-40 rotate-[12deg] bg-gradient-to-r from-transparent to-[#A8E0FF] opacity-45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[12%] bottom-[28%] h-px w-44 rotate-[14deg] bg-gradient-to-r from-transparent to-[#E0BCFF] opacity-45"
      />
      <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload files" />
      <div className="relative z-10 mx-auto flex w-[calc(100vw-3rem)] min-w-0 max-w-full flex-1 flex-col justify-center pb-20 pt-8 sm:w-full sm:max-w-[700px] lg:justify-start lg:pt-[27vh]">
        <StatusToast isThinking={isThinking} onStop={stopGeneration} />
        {messages.length > 0 && (
          <div className="mb-5 max-h-[32vh] space-y-3 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/35 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'text-right' : 'text-left'}
              >
                <div
                  className={`inline-block max-w-[84%] rounded-xl px-4 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-blue-500/15 text-blue-100 ring-1 ring-blue-400/20'
                      : 'bg-zinc-900 text-zinc-200 ring-1 ring-zinc-800'
                  }`}
                >
                  {message.content || '...'}
                </div>
              </div>
            ))}
          </div>
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
