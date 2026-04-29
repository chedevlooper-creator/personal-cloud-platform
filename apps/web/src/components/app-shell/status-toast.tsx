'use client';

import { Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StatusToast({ isThinking, onStop }: { isThinking: boolean; onStop: () => void }) {
  if (!isThinking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-2.5 text-sm text-foreground shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </div>
        <span className="text-[13px] font-medium tracking-tight text-foreground">
          Reasoning
        </span>
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Esc to cancel
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onStop}
        className="h-7 gap-1.5 px-2.5 text-xs font-medium"
      >
        <Square className="h-3 w-3" />
        Stop
      </Button>
    </div>
  );
}
