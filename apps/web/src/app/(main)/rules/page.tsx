'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authApi, getApiErrorMessage } from '@/lib/api';

type UserPreferences = {
  rules?: string | null;
};

export default function RulesPage() {
  const qc = useQueryClient();
  const [rules, setRules] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const res = await authApi.get('/user/preferences');
      return res.data as UserPreferences;
    },
    retry: false,
  });

  useEffect(() => {
    // Sync server-loaded rules into the local edit buffer when the query
    // resolves; safe one-shot per `data` change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setRules(data.rules ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await authApi.patch('/user/preferences', { rules: rules || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Rules saved.');
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save rules.')),
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rules</h2>
          <p className="text-sm text-muted-foreground">
            Free-form instructions injected into every agent system prompt. Use this for global
            preferences (style, language, defaults, do/don&apos;t lists).
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4">
        <textarea
          value={rules}
          disabled={isLoading}
          onChange={(e) => setRules(e.target.value)}
          rows={18}
          className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono"
          placeholder={`Examples:\n- Always answer in Turkish unless I write in English.\n- Prefer TypeScript over JavaScript when creating new files.\n- Never run destructive shell commands without confirmation.\n- Default code style: 2-space indent, single quotes.`}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {rules.length} characters · saved on every Save
          </p>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {save.isPending ? 'Saving...' : 'Save rules'}
          </Button>
        </div>
      </div>
    </div>
  );
}
