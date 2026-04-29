'use client';

import { Check, Copy, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

export function ChatMessages({
  messages,
  isThinking,
}: {
  messages: ChatMessage[];
  isThinking: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  return (
    <div
      ref={scrollRef}
      className="mb-5 max-h-[58vh] min-h-[200px] space-y-6 overflow-y-auto rounded-2xl border border-white/[0.05] bg-zinc-950/30 p-6 backdrop-blur-sm scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isThinking && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

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
        'group flex w-full items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-500',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
          isUser
            ? 'bg-zinc-800/80 ring-white/10 text-zinc-300'
            : 'bg-zinc-900/80 ring-white/[0.07] text-zinc-300',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('flex max-w-[82%] flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative whitespace-pre-wrap break-words rounded-xl px-4 py-2.5 text-[14px] leading-[1.65]',
            isUser
              ? 'rounded-tr-sm bg-zinc-800/70 text-zinc-100 ring-1 ring-white/[0.06]'
              : 'rounded-tl-sm bg-zinc-900/60 text-zinc-100 ring-1 ring-white/[0.05]',
          )}
        >
          {message.content || (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-500" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-500 [animation-delay:140ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-zinc-500 [animation-delay:280ms]" />
            </span>
          )}
          {message.streaming && message.content && (
            <span className="ml-0.5 inline-block h-3.5 w-[1.5px] translate-y-[2px] animate-pulse bg-zinc-400/80" />
          )}
        </div>
        {!isUser && message.content && !message.streaming && (
          <button
            type="button"
            onClick={copy}
            className="mt-1 flex items-center gap-1 px-1 text-[10px] uppercase tracking-wider text-zinc-500 opacity-0 transition-opacity hover:text-zinc-200 group-hover:opacity-100"
            aria-label="Copy message"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-in fade-in duration-200">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-900/80 ring-1 ring-white/[0.07]">
        <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
      </div>
      <div className="rounded-xl rounded-tl-sm bg-zinc-900/60 px-4 py-3 ring-1 ring-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400/80" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400/80 [animation-delay:140ms]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400/80 [animation-delay:280ms]" />
        </div>
      </div>
    </div>
  );
}
