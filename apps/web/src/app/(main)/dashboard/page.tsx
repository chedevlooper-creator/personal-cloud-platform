'use client';

import { useState, useCallback } from 'react';
import { Send, Loader2, Sparkles, Code2, Database, FolderOpen, Zap } from 'lucide-react';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { cn } from '@/lib/utils';

const quickActions = [
  { label: 'Yeni bir proje başlat', icon: Sparkles },
  { label: "Kodu analiz et ve düzelt", icon: Code2 },
  { label: "Bir API endpoint'i oluştur", icon: Zap },
  { label: 'Veri setini incele ve özetle', icon: Database },
  { label: 'Çalışma alanındaki dosyaları düzenle', icon: FolderOpen },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export default function DashboardPage() {
  const [input, setInput] = useState('');
  const { startNewChat, setIsOpen, setPendingMessage } = useChatPanel();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = useCallback(
    (message: string) => {
      const text = message.trim();
      if (!text || isSubmitting) return;
      setIsSubmitting(true);
      startNewChat();
      setIsOpen(true);
      setPendingMessage(text);
      setInput('');
      window.setTimeout(() => setIsSubmitting(false), 500);
    },
    [isSubmitting, startNewChat, setIsOpen, setPendingMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
      <div className="aurora-bg" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-4">
        <div className="mb-10 text-center animate-fade-up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Agent hazır
          </div>
          <h1 className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-4xl">
            {getGreeting()}, hoş geldiniz
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Bugün ne yapmak istersiniz? Bir görev verin veya hızlı aksiyonlardan birini seçin.
          </p>
        </div>

        <div className="w-full animate-fade-up [animation-delay:80ms]">
          <div
            className={cn(
              'relative flex items-end gap-2 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-[0_12px_50px_-20px_color-mix(in_oklch,var(--primary)_30%,transparent)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200',
              'focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_15%,transparent),0_18px_60px_-20px_color-mix(in_oklch,var(--primary)_40%,transparent)]',
            )}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Agent'a bir görev verin..."
              rows={1}
              disabled={isSubmitting}
              className="min-h-[60px] flex-1 resize-none bg-transparent px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 scroll-elegant"
              aria-label="Chat message input"
            />
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isSubmitting}
              className={cn(
                'press relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary-foreground transition-[background,box-shadow,opacity] duration-200',
                'bg-[linear-gradient(120deg,var(--chart-1),var(--chart-4)_55%,var(--chart-1))] bg-[length:200%_100%] bg-[position:0%_50%] hover:bg-[position:100%_50%]',
                'shadow-[0_6px_20px_-6px_color-mix(in_oklch,var(--primary)_55%,transparent)] hover:shadow-[0_12px_36px_-8px_color-mix(in_oklch,var(--primary)_70%,transparent)]',
                'disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
              )}
              aria-label="Mesaj gönder"
              title="Mesaj gönder"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleSend(action.label)}
                  disabled={isSubmitting}
                  style={{ animationDelay: `${120 + idx * 40}ms` }}
                  className={cn(
                    'press group/chip animate-fade-up inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur-md',
                    'transition-[border-color,background-color,color,box-shadow] duration-200',
                    'hover:border-primary/40 hover:bg-card/90 hover:text-foreground hover:shadow-[0_4px_18px_-6px_color-mix(in_oklch,var(--primary)_35%,transparent)]',
                    'disabled:opacity-50',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-primary/70 transition-colors group-hover/chip:text-primary" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
