'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agentApi, toastApiError} from '@/lib/api';

type Skill = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bodyMarkdown: string | null;
  triggers: string[];
  enabled: boolean;
};

type FormState = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  bodyMarkdown: string;
  triggers: string;
  enabled: boolean;
};

const empty: FormState = {
  slug: '',
  name: '',
  description: '',
  bodyMarkdown: '',
  triggers: '',
  enabled: true,
};

export default function SkillsPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<FormState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await agentApi.get('/skills');
      return (res.data?.skills ?? []) as Skill[];
    },
    retry: false,
  });
  const skills = data ?? [];

  const save = useMutation({
    mutationFn: async (form: FormState) => {
      const triggers = form.triggers
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (form.id) {
        await agentApi.patch(`/skills/${form.id}`, {
          name: form.name,
          description: form.description || null,
          bodyMarkdown: form.bodyMarkdown || null,
          triggers,
          enabled: form.enabled,
        });
      } else {
        await agentApi.post('/skills', {
          slug: form.slug,
          name: form.name,
          description: form.description || null,
          bodyMarkdown: form.bodyMarkdown || null,
          triggers,
          enabled: form.enabled,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success(editor?.id ? 'Skill updated.' : 'Skill created.');
      setEditor(null);
    },
    onError: (e) => toastApiError(e, 'Could not save skill.'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/skills/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill deleted.');
    },
    onError: (e) => toastApiError(e, 'Could not delete skill.'),
  });

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
              {!isLoading && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {enabledCount}/{skills.length} enabled
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Reusable SKILL.md instructions the agent loads when triggered keywords match.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setEditor({ ...empty })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New skill
        </Button>
      </header>
      <div className="mx-auto max-w-4xl">

      {editor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editor.name.trim() || !editor.slug.trim()) return;
            save.mutate(editor);
          }}
          className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sk-slug">Slug</Label>
              <Input
                id="sk-slug"
                value={editor.slug}
                disabled={Boolean(editor.id)}
                onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
                placeholder="research-topic"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sk-name">Name</Label>
              <Input
                id="sk-name"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="Research Topic"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sk-desc">Description</Label>
            <Input
              id="sk-desc"
              value={editor.description}
              onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              placeholder="One-line summary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sk-trig">
              Triggers (comma-separated keywords; substring match on user input)
            </Label>
            <Input
              id="sk-trig"
              value={editor.triggers}
              onChange={(e) => setEditor({ ...editor, triggers: e.target.value })}
              placeholder="research, summarize, report"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sk-body">SKILL.md body</Label>
            <textarea
              id="sk-body"
              value={editor.bodyMarkdown}
              onChange={(e) => setEditor({ ...editor, bodyMarkdown: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-border bg-card p-3 text-sm font-mono"
              placeholder="# Skill instructions...\n\nWhen invoked, the agent should..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editor.enabled}
              onChange={(e) => setEditor({ ...editor, enabled: e.target.checked })}
            />
            Enabled
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" type="button" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : skills.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No skills yet. Create one to give the agent reusable instructions.
          </div>
        ) : (
          skills.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{s.name}</h3>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {s.slug}
                    </span>
                    {!s.enabled && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Disabled
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  )}
                  {s.triggers.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Triggers: {s.triggers.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditor({
                      id: s.id,
                      slug: s.slug,
                      name: s.name,
                      description: s.description ?? '',
                      bodyMarkdown: s.bodyMarkdown ?? '',
                      triggers: s.triggers.join(', '),
                      enabled: s.enabled,
                    })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete skill "${s.name}"?`)) remove.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
