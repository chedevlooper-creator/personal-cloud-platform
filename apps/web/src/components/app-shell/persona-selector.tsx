'use client';

import { Bot, Check } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { agentApi } from '@/lib/api';
import { usePersonaStore } from '@/store/persona';
import { cn } from '@/lib/utils';

type Persona = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  isDefault: boolean;
};

export function PersonaSelector({ compact }: { compact?: boolean }) {
  const { activePersonaId, activePersonaName, setActivePersona } = usePersonaStore();

  const { data } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const res = await agentApi.get('/personas');
      return (res.data?.personas ?? []) as Persona[];
    },
    retry: false,
  });

  const personas = data ?? [];
  const currentName =
    activePersonaName ||
    personas.find((p) => p.id === activePersonaId)?.name ||
    personas.find((p) => p.isDefault)?.name ||
    'Default';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            size="sm"
            title={`Active persona: ${currentName}`}
            aria-label="Select assistant persona"
            className={cn(
              'rounded-full border-border bg-muted/50 text-foreground hover:bg-muted transition-all active:scale-[0.98]',
              compact && 'h-7 w-7 px-0',
            )}
          >
            <Bot className={cn('h-4 w-4', !compact && 'mr-1.5')} />
            {compact ? null : <span className="max-w-[120px] truncate text-xs">{currentName}</span>}
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Persona</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setActivePersona(null, null)}
          className="flex items-center justify-between"
        >
          <span>Default (none)</span>
          {!activePersonaId && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {personas.length > 0 && <DropdownMenuSeparator />}
        {personas.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setActivePersona(p.id, p.name)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{p.name}</span>
            {activePersonaId === p.id && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={(props) => <Link {...props} href="/personas" />}>
          Manage personas...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
