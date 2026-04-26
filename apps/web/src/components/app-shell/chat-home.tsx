'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatComposer } from '@/components/app-shell/chat-composer';
import { StatusToast } from '@/components/app-shell/status-toast';
import { ToolApproval } from '@/components/app-shell/tool-approval-card';
import { agentApi, getApiErrorMessage } from '@/lib/api';

export function ChatHome() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
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

    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: prompt }]);
    setInput('');
    setIsThinking(true);
    setToolApproval(null);

    const needsTool = /\b(file|deploy|publish|terminal|workspace|host)\b/i.test(prompt);
    if (needsTool) {
      setTimeout(() => {
        setToolApproval({
          toolName: prompt.match(/\bdeploy|publish|host\b/i) ? 'prepare_deployment' : 'workspace_inspector',
          description: 'Review workspace context before taking action.',
        });
      }, 450);
    }

    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await agentApi.post(
        '/agent/chat',
        { input: prompt },
        { signal: controller.signal }
      );
      const content =
        (response.data as { content?: string }).content ||
        'I did not receive a response from the model.';

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content } : message
        )
      );
    } catch (error) {
      const content = controller.signal.aborted
        ? 'Generation stopped.'
        : getApiErrorMessage(error, 'The MiniMax agent service is not available.');

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content } : message
        )
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsThinking(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-col px-4 pb-24 pt-8 sm:px-8 lg:px-12">
      <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Upload files" />
      <div className="mx-auto flex w-[calc(100vw-3rem)] min-w-0 max-w-full flex-1 flex-col justify-center pb-28 pt-8 sm:w-full sm:max-w-[1120px] lg:justify-start lg:pt-[23vh]">
        <StatusToast isThinking={isThinking} onStop={stopGeneration} />
        {messages.length > 0 && (
          <div className="mb-5 max-h-[32vh] space-y-3 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/35 p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
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
      </div>
    </div>
  );
}
