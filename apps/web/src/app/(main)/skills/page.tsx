'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Plus,
  Pencil,
  Sparkles,
  Trash2,
  Download,
  Check,
  Library,
  Globe,
  Search,
  ExternalLink,
} from 'lucide-react';
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
  const [showCatalog, setShowCatalog] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverView, setDiscoverView] = useState<'trending' | 'all-time' | 'hot'>('trending');

  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await agentApi.get('/skills');
      return (res.data?.skills ?? []) as Skill[];
    },
    retry: false,
  });
  const skills = data ?? [];

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['skills-catalog'],
    queryFn: async () => {
      const res = await agentApi.get('/skills/catalog');
      return (res.data?.skills ?? []) as Array<{
        slug: string;
        name: string;
        description: string;
        category: string;
        triggers: string[];
        bodyMarkdown: string;
        installed: boolean;
      }>;
    },
    enabled: showCatalog,
    retry: false,
  });

  const installPreset = useMutation({
    mutationFn: async (slug: string) => {
      await agentApi.post('/skills/install', { slug });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: ['skills-catalog'] });
      toast.success('Skill installed.');
    },
    onError: (e) => toastApiError(e, 'Could not install skill.'),
  });

  type RegistryItem = {
    id: string;
    slug: string;
    name: string;
    source: string;
    installs: number;
    sourceType: string;
    installUrl: string | null;
    url: string;
    isDuplicate?: boolean;
    installed: boolean;
  };

  const { data: discoverData, isLoading: discoverLoading } = useQuery({
    queryKey: ['skills-discover', discoverView, discoverQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ view: discoverView, limit: '30' });
      if (discoverQuery.trim().length >= 2) params.set('q', discoverQuery.trim());
      const res = await agentApi.get(`/skills/registry?${params.toString()}`);
      return (res.data?.skills ?? []) as RegistryItem[];
    },
    enabled: showDiscover,
    retry: false,
  });

  const installRegistry = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.post('/skills/registry/install', { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: ['skills-discover'] });
      toast.success('Skill imported from skills.sh.');
    },
    onError: (e) => toastApiError(e, 'Could not install skill from skills.sh.'),
  });

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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCatalog((v) => !v)}>
            <Library className="mr-1.5 h-3.5 w-3.5" />
            {showCatalog ? 'Hide catalog' : 'Browse catalog'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowDiscover((v) => !v)}>
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            {showDiscover ? 'Hide skills.sh' : 'Discover (skills.sh)'}
          </Button>
          <Button size="sm" onClick={() => setEditor({ ...empty })}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New skill
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-4xl">

      {showCatalog && (
        <section className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-3 flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Skill catalog
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {catalogData?.length ?? 0} presets
            </span>
          </div>
          {catalogLoading ? (
            <p className="text-sm text-muted-foreground">Loading catalog...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(catalogData ?? []).map((c) => (
                <div
                  key={c.slug}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{c.name}</h3>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {c.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {c.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={c.installed ? 'outline' : 'default'}
                      disabled={c.installed || installPreset.isPending}
                      onClick={() => installPreset.mutate(c.slug)}
                      className="shrink-0"
                    >
                      {c.installed ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Installed
                        </>
                      ) : (
                        <>
                          <Download className="mr-1 h-3.5 w-3.5" /> Install
                        </>
                      )}
                    </Button>
                  </div>
                  {c.triggers.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Triggers: {c.triggers.slice(0, 4).join(', ')}
                      {c.triggers.length > 4 && '…'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showDiscover && (
        <section className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Discover on skills.sh
            </h2>
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              skills.sh
            </a>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                placeholder="Search skills (min 2 chars)…"
                className="pl-7"
              />
            </div>
            <select
              value={discoverView}
              onChange={(e) => setDiscoverView(e.target.value as typeof discoverView)}
              disabled={discoverQuery.trim().length >= 2}
              className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-foreground disabled:opacity-50"
            >
              <option value="trending">Trending</option>
              <option value="hot">Hot</option>
              <option value="all-time">All-time</option>
            </select>
          </div>
          {discoverLoading ? (
            <p className="text-sm text-muted-foreground">Loading from skills.sh…</p>
          ) : (discoverData ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(discoverData ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-foreground">{s.name}</h3>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          title="Open on skills.sh"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground">
                        {s.source}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {s.installs.toLocaleString()} installs
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={s.installed ? 'outline' : 'default'}
                      disabled={s.installed || installRegistry.isPending}
                      onClick={() => installRegistry.mutate(s.id)}
                      className="shrink-0"
                    >
                      {s.installed ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Imported
                        </>
                      ) : (
                        <>
                          <Download className="mr-1 h-3.5 w-3.5" /> Import
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editor.name.trim() || !editor.slug.trim()) return;
            save.mutate(editor);
          }}
          className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4"
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
              className="flex items-start justify-between rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4"
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
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground dark:text-warning">
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
