'use client';

import { ChevronDown, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ModelSelector({ model = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax-M2.7' }: { model?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      title="Select model"
      aria-label="Select model"
      className="h-8 rounded-full border-zinc-700 bg-zinc-900/70 px-3 text-zinc-200 hover:bg-zinc-800 dark:border-zinc-700"
    >
      <Cpu className="h-4 w-4 text-zinc-400" />
      <span className="max-w-28 truncate">{model}</span>
      <ChevronDown className="h-4 w-4 text-zinc-500" />
    </Button>
  );
}
