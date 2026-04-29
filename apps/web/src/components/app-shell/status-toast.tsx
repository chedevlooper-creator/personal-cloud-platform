'use client';

import { Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StatusToast({ isThinking, onStop }: { isThinking: boolean; onStop: () => void }) {
  if (!isThinking) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#404148] bg-[#16171A]/90 px-4 py-3 text-sm text-zinc-300 shadow-lg">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
        Assistant is thinking. Press Esc to stop.
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onStop}>
        <Square className="h-3.5 w-3.5" />
        Stop
      </Button>
    </div>
  );
}
