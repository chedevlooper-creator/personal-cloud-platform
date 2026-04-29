'use client';

import { Sparkles, Check, X } from 'lucide-react';
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
import { useActiveSkillsStore } from '@/store/skills';

type Skill = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  enabled: boolean;
};

export function SkillSelector() {
  const { activeSkillIds, toggleSkill, clear } = useActiveSkillsStore();

  const { data } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await agentApi.get('/skills');
      return (res.data?.skills ?? []) as Skill[];
    },
    retry: false,
  });

  const skills = (data ?? []).filter((s) => s.enabled);
  const activeCount = activeSkillIds.length;
  const label = activeCount > 0 ? `${activeCount} skill${activeCount > 1 ? 's' : ''}` : 'Skills';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            size="sm"
            title={`Active skills: ${activeCount}`}
            aria-label="Select active skills"
            className="rounded-full"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            <span className="max-w-[140px] truncate text-xs">{label}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Skills (max 5)</DropdownMenuLabel>
        {skills.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No enabled skills. Create one in Skills.
          </div>
        )}
        {skills.map((s) => {
          const active = activeSkillIds.includes(s.id);
          return (
            <DropdownMenuItem
              key={s.id}
              onClick={(e) => {
                e.preventDefault();
                toggleSkill(s.id);
              }}
              className="flex items-center justify-between"
            >
              <span className="truncate">{s.name}</span>
              {active && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                clear();
              }}
              className="text-muted-foreground"
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Clear selection
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={(props) => <Link {...props} href="/skills" />}>
          Manage skills...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
