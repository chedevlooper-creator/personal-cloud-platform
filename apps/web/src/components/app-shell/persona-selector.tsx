'use client';

import { Bot, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PersonaSelector() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      title="Select assistant persona"
      aria-label="Select assistant persona"
      className="rounded-full border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800 dark:border-zinc-700"
    >
      <Bot className="h-4 w-4" />
      <ChevronDown className="sr-only" />
    </Button>
  );
}
