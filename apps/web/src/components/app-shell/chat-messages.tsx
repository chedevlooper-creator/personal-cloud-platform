'use client';

import { Check, Copy, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/app-shell/markdown';

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
      className="mb-5 max-h-[58vh] min-h-[200px] space-y-6 overflow-y-auto rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm"
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
        'group flex w-full gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border/60">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div className={cn('flex max-w-[78%] flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative break-words rounded-2xl px-4 py-2.5 text-sm leading-[1.7] tracking-[-0.005em]',
            isUser
              ? 'rounded-tr-md bg-primary text-primary-foreground'
              : 'rounded-tl-md bg-card text-foreground ring-1 ring-border/60',
          )}
        >
          {message.content ? (
            isUser ? (
              <span className="whitespace-pre-wrap">{message.content}</span>
            ) : (
              <Markdown text={message.content} />
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-pulse" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-pulse [animation-delay:140ms]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-pulse [animation-delay:280ms]" />
            </span>
          )}
          {message.streaming && message.content && (
            <span className="ml-0.5 inline-block h-3.5 w-[1.5px] translate-y-[2px] bg-foreground/80 motion-safe:animate-pulse" />
          )}
        </div>
        {!isUser && message.content && !message.streaming && (
          <button
            type="button"
            onClick={copy}
            className="mt-1 flex items-center gap-1 px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            aria-label="Mesajı kopyala"
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
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ring-1 ring-border/40">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted ring-1 ring-border/60">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="rounded-xl rounded-tl-sm bg-card px-4 py-3 ring-1 ring-border/60" role="status" aria-live="polite" aria-label="Agent yazıyor">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-bounce" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-bounce [animation-delay:140ms]" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground motion-safe:animate-bounce [animation-delay:280ms]" />
        </div>
      </div>
    </div>
  );
}
