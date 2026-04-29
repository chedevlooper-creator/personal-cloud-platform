'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Plus, Trash2, ImageDown, FileText, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { browserApi, toastApiError} from '@/lib/api';

type Session = {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  lastUsedAt: string;
};

type ExtractResult = {
  url: string;
  title: string;
  text: string;
  links: Array<{ href: string; text: string }>;
};

export default function BrowserPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [navUrl, setNavUrl] = useState('https://example.com');
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [shotSrc, setShotSrc] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['browser-sessions'],
    queryFn: async () => {
      const res = await browserApi.get('/browser/sessions');
      return (res.data?.sessions ?? []) as Session[];
    },
    retry: false,
  });
  const sessions = data ?? [];

  const create = useMutation({
    mutationFn: async () => {
      const res = await browserApi.post('/browser/sessions');
      return res.data as Session;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
      setActiveId(s.id);
      toast.success('Session started.');
    },
    onError: (e) => toastApiError(e, 'Could not start session.'),
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      await browserApi.delete(`/browser/sessions/${id}`);
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
      if (activeId === id) {
        setActiveId(null);
        setExtract(null);
        setShotSrc(null);
      }
    },
    onError: (e) => toastApiError(e, 'Could not close session.'),
  });

  const navigate = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const res = await browserApi.post(`/browser/sessions/${id}/navigate`, { url });
      return res.data as Session;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['browser-sessions'] });
    },
    onError: (e) => toastApiError(e, 'Navigate failed.'),
  });

  const doExtract = useMutation({
    mutationFn: async (id: string) => {
      const res = await browserApi.get(`/browser/sessions/${id}/extract`);
      return res.data as ExtractResult;
    },
    onSuccess: (r) => setExtract(r),
    onError: (e) => toastApiError(e, 'Extract failed.'),
  });

  const doShot = useMutation({
    mutationFn: async (id: string) => {
      const res = await browserApi.get(`/browser/sessions/${id}/screenshot`);
      return (res.data as { pngBase64: string }).pngBase64;
    },
    onSuccess: (b64) => setShotSrc(`data:image/png;base64,${b64}`),
    onError: (e) => toastApiError(e, 'Screenshot failed.'),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">Cloud Browser</h2>
          <p className="text-sm text-muted-foreground">
            Headless Playwright sessions with persistent per-user profiles. Navigate, extract page
            content, or take screenshots.
          </p>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          New session
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-3">
          <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sessions
          </h3>
          {isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No active sessions. Start one to begin.
            </p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(s.id);
                      setNavUrl(s.url === 'about:blank' ? 'https://example.com' : s.url);
                      setExtract(null);
                      setShotSrc(null);
                    }}
                    className={`group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      activeId === s.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {s.title || s.url || 'Blank tab'}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{s.url}</div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Close this session?')) close.mutate(s.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          if (confirm('Close this session?')) close.mutate(s.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="space-y-4">
          {activeId ? (
            <>
              <div className="rounded-xl border border-border bg-card p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!navUrl.trim()) return;
                    navigate.mutate({ id: activeId, url: navUrl.trim() });
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={navUrl}
                    onChange={(e) => setNavUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button type="submit" size="sm" disabled={navigate.isPending}>
                    {navigate.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </form>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => doExtract.mutate(activeId)}
                    disabled={doExtract.isPending}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Extract
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => doShot.mutate(activeId)}
                    disabled={doShot.isPending}
                  >
                    <ImageDown className="mr-1.5 h-3.5 w-3.5" />
                    Screenshot
                  </Button>
                </div>
              </div>

              {shotSrc && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-xs text-muted-foreground">Latest screenshot</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shotSrc}
                    alt="screenshot"
                    className="max-h-[600px] w-full rounded-md border border-border object-contain"
                  />
                </div>
              )}

              {extract && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <h4 className="mb-1 truncate font-medium text-foreground">{extract.title}</h4>
                  <p className="mb-2 truncate text-[11px] text-muted-foreground">{extract.url}</p>
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-foreground">
                    {extract.text}
                  </pre>
                  {extract.links.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {extract.links.length} links
                      </summary>
                      <ul className="mt-2 max-h-[200px] space-y-0.5 overflow-auto text-xs">
                        {extract.links.slice(0, 50).map((l, i) => (
                          <li key={i} className="truncate">
                            <a
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {l.text || l.href}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Select or start a session to begin.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
