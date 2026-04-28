'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bot, Sparkles, ScrollText } from 'lucide-react';
import { authApi } from '@/lib/api';
import { PersonaSelector } from '@/components/app-shell/persona-selector';
import { SkillSelector } from '@/components/app-shell/skill-selector';
import { usePersonaStore } from '@/store/persona';
import { useActiveSkillsStore } from '@/store/skills';

export function ChatContextBar() {
  const { activePersonaName } = usePersonaStore();
  const { activeSkillIds } = useActiveSkillsStore();

  const { data: prefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const res = await authApi.get('/user/preferences');
      return res.data as { rules?: string | null };
    },
    retry: false,
  });

  const hasRules = Boolean(prefs?.rules && prefs.rules.trim().length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <PersonaSelector />
      <SkillSelector />
      <Link
        href="/rules"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 hover:border-primary/40 hover:text-foreground"
        title={hasRules ? 'Rules active. Click to edit.' : 'No rules set. Click to add.'}
      >
        <ScrollText className="h-3.5 w-3.5" />
        <span>{hasRules ? 'Rules: on' : 'Rules: off'}</span>
      </Link>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1">
        <Bot className="h-3.5 w-3.5" />
        <span>{process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax-M2.7'}</span>
      </span>
      {activeSkillIds.length === 0 && !activePersonaName && !hasRules && (
        <span className="hidden text-[11px] text-muted-foreground/70 sm:inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Tip: pick a persona or skill to steer the agent.
        </span>
      )}
    </div>
  );
}
