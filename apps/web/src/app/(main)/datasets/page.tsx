'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Upload, Trash2, Play, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { workspaceApi, apiEndpoints, toastApiError} from '@/lib/api';

type Dataset = {
  id: string;
  name: string;
  tableName: string;
  sourceType: string;
  sourceFilename: string | null;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  sizeBytes: number;
  createdAt: string;
};

type QueryResult = {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
};

const ACCEPT = '.csv,.tsv,.json,.ndjson,.jsonl,.parquet';

export default function DatasetsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const res = await workspaceApi.get('/datasets');
      return (res.data?.datasets ?? []) as Dataset[];
    },
    retry: false,
  });
  const datasets = data ?? [];
  const active = useMemo(
    () => datasets.find((d) => d.id === activeId) ?? null,
    [datasets, activeId],
  );

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name.replace(/\.[^.]+$/, ''));
      const res = await axios.post(`${apiEndpoints.workspace}/datasets/import`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as Dataset;
    },
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ['datasets'] });
      setActiveId(ds.id);
      setSql(`SELECT * FROM "${ds.tableName}" LIMIT 100`);
      toast.success(
        `Imported ${ds.rowCount.toLocaleString()} rows from ${ds.sourceFilename ?? ds.name}.`,
      );
    },
    onError: (e) => toastApiError(e, 'Import failed.'),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      await workspaceApi.delete(`/datasets/${id}`);
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['datasets'] });
      if (activeId === id) {
        setActiveId(null);
        setResult(null);
      }
      toast.success('Dataset removed.');
    },
    onError: (e) => toastApiError(e, 'Could not remove dataset.'),
  });

  const queryMut = useMutation({
    mutationFn: async (q: string) => {
      const res = await workspaceApi.post(`/datasets/query`, { sql: q, rowLimit: 500 });
      return res.data as QueryResult;
    },
    onSuccess: (r) => setResult(r),
    onError: (e) => toastApiError(e, 'Query failed.'),
  });

  const previewMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceApi.get(`/datasets/${id}/preview`, { params: { limit: 50 } });
      return res.data as QueryResult;
    },
    onSuccess: (r) => setResult(r),
    onError: (e) => toastApiError(e, 'Preview failed.'),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    importMut.mutate(f);
    e.target.value = '';
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">Datasets</h2>
          <p className="text-sm text-muted-foreground">
            Upload CSV, JSON, or Parquet files into your private DuckDB and query them with SQL.
          </p>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={onPickFile} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} disabled={importMut.isPending}>
          {importMut.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          {importMut.isPending ? 'Importing...' : 'Import file'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-3">
          <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Catalog
          </h3>
          {isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Loading...</p>
          ) : datasets.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No datasets yet. Import a file to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {datasets.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(d.id);
                      setSql(`SELECT * FROM "${d.tableName}" LIMIT 100`);
                    }}
                    className={`group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      activeId === d.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{d.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {d.tableName} · {d.rowCount.toLocaleString()} rows · {d.columns.length} cols
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove dataset "${d.name}"?`)) removeMut.mutate(d.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          if (confirm(`Remove dataset "${d.name}"?`)) removeMut.mutate(d.id);
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
          {active ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">{active.name}</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                  {active.sourceType}
                </span>
                <span className="text-xs text-muted-foreground">
                  table <code className="font-mono">{active.tableName}</code>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => previewMut.mutate(active.id)}
                  disabled={previewMut.isPending}
                  className="ml-auto"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Preview
                </Button>
              </div>

              <div className="mb-2">
                <Label className="text-xs text-muted-foreground">SQL</Label>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={`SELECT * FROM "${active.tableName}" LIMIT 100`}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => sql.trim() && queryMut.mutate(sql)}
                  disabled={!sql.trim() || queryMut.isPending}
                >
                  {queryMut.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Select a dataset on the left or import a new file.
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {result.rowCount} rows · {result.durationMs}ms
                  {result.truncated && ' · truncated'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {result.columns.map((c) => (
                        <th
                          key={c.name}
                          className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-foreground"
                        >
                          {c.name}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {c.type}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="max-w-[280px] truncate whitespace-nowrap px-2 py-1 font-mono text-muted-foreground"
                          >
                            {formatCell(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
