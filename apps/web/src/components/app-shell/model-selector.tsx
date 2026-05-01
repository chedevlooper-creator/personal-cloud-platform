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
      title="Model seç"
      aria-label="Model seç"
      className={cn(
              'rounded-full border-border bg-muted/50 text-foreground hover:bg-muted transition-all active:scale-[0.98]',
        compact ? 'h-11 px-3 text-xs font-medium md:h-7 md:px-2.5' : 'h-8 px-3 font-medium',
      )}
    >
      <Cpu className={cn('text-foreground/80', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      <span className="max-w-28 truncate">{model}</span>
      <ChevronDown className={cn('text-muted-foreground', compact ? 'h-3 w-3' : 'h-4 w-4')} />
    </Button>
  );
}
