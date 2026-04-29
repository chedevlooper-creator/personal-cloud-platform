'use client';

import { ChevronDown, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ModelSelector({
  model = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax 2.7',
  compact,
}: {
  model?: string;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      title="Select model"
      aria-label="Select model"
      className={cn(
        'rounded-full border-[#60626A] bg-[#202126] text-[#F3F3F3] hover:bg-[#27282E] dark:border-[#60626A]',
        compact ? 'h-7 px-2.5 text-xs font-extrabold' : 'h-8 px-3',
      )}
    >
      <Cpu className={cn('text-[#F2F2F2]', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      <span className="max-w-28 truncate">{model}</span>
      <ChevronDown className={cn('text-[#C2C4C8]', compact ? 'h-3 w-3' : 'h-4 w-4')} />
    </Button>
  );
}
