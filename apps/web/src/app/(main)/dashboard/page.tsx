'use client';

import { useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { DottedBackground } from '@/components/app-shell/dotted-background';
import { cn } from '@/lib/utils';

const quickActions = [
  'Yeni bir proje başlat',
  'Kodu analiz et ve düzelt',
  'Bir API endpoint\'i oluştur',
  'Veri setini incele ve özetle',
  'Çalışma alanındaki dosyaları düzenle',
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
      // Reset submitting after a short delay to allow mutation to start
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
      {/* Decorative glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full opacity-[0.12] blur-3xl"
          style={{ backgroundColor: '#B85CFF' }}
        />
        <div
          className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full opacity-[0.09] blur-3xl"
          style={{ backgroundColor: '#F5A524' }}
        />
        <div
          className="absolute left-[-10%] top-[30%] h-[350px] w-[350px] rounded-full opacity-[0.07] blur-3xl"
          style={{ backgroundColor: '#3FB6E0' }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] h-[300px] w-[300px] rounded-full opacity-[0.08] blur-3xl"
          style={{ backgroundColor: '#7CD992' }}
        />
      </div>

      {/* Dot background */}
      <DottedBackground className="opacity-45" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-4">
        {/* Greeting */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            {getGreeting()}, hoş geldiniz
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Bugün ne yapmak istersiniz? Bir görev verin veya hızlı aksiyonlardan birini seçin.
          </p>
        </div>

        {/* Chat input bar */}
        <div className="w-full">
          <div
            className={cn(
              'flex items-end gap-2 rounded-2xl border border-white/[0.07] bg-card/80 p-3 shadow-lg backdrop-blur-sm',
              'transition-shadow focus-within:ring-2 focus-within:ring-primary/20',
            )}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Agent'a bir görev verin..."
              rows={1}
              disabled={isSubmitting}
              className="min-h-[56px] flex-1 resize-none bg-transparent px-2 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Chat message input"
            />
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isSubmitting}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors',
                'hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground',
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

          {/* Quick-action chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleSend(action)}
                disabled={isSubmitting}
                className={cn(
                  'min-h-[32px] rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground',
                  'transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50',
                )}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
