'use client';

import { Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StatusToast({ isThinking, onStop }: { isThinking: boolean; onStop: () => void }) {
  if (!isThinking) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-gradient-to-r from-zinc-950/80 via-zinc-900/70 to-zinc-950/80 px-4 py-2.5 text-sm text-zinc-200 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-3">
        <div className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-300" />
        </div>
        <span className="text-[13px] font-medium tracking-tight text-zinc-200">
          Reasoning
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          Esc to cancel
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onStop}
        className="h-7 gap-1.5 border-white/10 bg-white/[0.03] px-2.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.06] hover:text-white"
      >
        <Square className="h-3 w-3" />
        Stop
      </Button>
    </div>
  );
}
