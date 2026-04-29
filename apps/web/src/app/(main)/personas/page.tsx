'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agentApi, toastApiError} from '@/lib/api';

type Persona = {
  id: string;
  slug: string;
  name: string;
  systemPrompt: string;
  icon: string | null;
  isDefault: boolean;
};

type FormState = {
  id?: string;
  slug: string;
  name: string;
  systemPrompt: string;
  isDefault: boolean;
};

const empty: FormState = { slug: '', name: '', systemPrompt: '', isDefault: false };

export default function PersonasPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<FormState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const res = await agentApi.get('/personas');
      return (res.data?.personas ?? []) as Persona[];
    },
    retry: false,
  });
  const personas = data ?? [];

  const save = useMutation({
    mutationFn: async (form: FormState) => {
      if (form.id) {
        await agentApi.patch(`/personas/${form.id}`, {
          name: form.name,
          systemPrompt: form.systemPrompt,
          isDefault: form.isDefault,
        });
      } else {
        await agentApi.post('/personas', {
          slug: form.slug,
          name: form.name,
          systemPrompt: form.systemPrompt,
          isDefault: form.isDefault,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personas'] });
      toast.success(editor?.id ? 'Persona updated.' : 'Persona created.');
      setEditor(null);
    },
    onError: (e) => toastApiError(e, 'Could not save persona.'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/personas/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personas'] });
      toast.success('Persona deleted.');
    },
    onError: (e) => toastApiError(e, 'Could not delete persona.'),
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Personas</h2>
          <p className="text-sm text-muted-foreground">
            System-prompt presets the agent uses. The default persona is auto-applied when nothing
            is selected.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditor({ ...empty })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New persona
        </Button>
      </div>

      {editor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editor.name.trim() || !editor.slug.trim() || !editor.systemPrompt.trim()) return;
            save.mutate(editor);
          }}
          className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-slug">Slug</Label>
              <Input
                id="p-slug"
                value={editor.slug}
                disabled={Boolean(editor.id)}
                onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
                placeholder="code-reviewer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="Code Reviewer"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-prompt">System prompt</Label>
            <textarea
              id="p-prompt"
              value={editor.systemPrompt}
              onChange={(e) => setEditor({ ...editor, systemPrompt: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-border bg-card p-3 text-sm font-mono"
              placeholder="You are a careful senior reviewer..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editor.isDefault}
              onChange={(e) => setEditor({ ...editor, isDefault: e.target.checked })}
            />
            Use as default persona
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
        ) : personas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No personas yet. Create one to customize the agent&apos;s tone and focus.
          </div>
        ) : (
          personas.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{p.name}</h3>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {p.slug}
                    </span>
                    {p.isDefault && (
                      <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        <Star className="h-2.5 w-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">
                    {p.systemPrompt}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditor({
                      id: p.id,
                      slug: p.slug,
                      name: p.name,
                      systemPrompt: p.systemPrompt,
                      isDefault: p.isDefault,
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
                    if (confirm(`Delete persona "${p.name}"?`)) remove.mutate(p.id);
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
  );
}
