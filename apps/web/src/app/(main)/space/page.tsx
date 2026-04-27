'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Boxes, Camera, Database, FolderKanban, HardDrive } from 'lucide-react';
import { workspaceApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';

type Workspace = {
  id: string;
  name: string;
  storageUsed: number;
  storageLimit: number;
  updatedAt: string;
};

type WorkspacesResponse = { workspaces: Workspace[] };

type Dataset = {
  id: string;
  name: string;
  format: string;
  rowCount: number | null;
  sizeBytes: number | null;
  createdAt: string;
};

type DatasetsResponse = { datasets: Dataset[] };

type Snapshot = {
  id: string;
  workspaceId: string;
  status: string;
  sizeBytes: number | null;
  createdAt: string;
};

export default function SpacePage() {
  const results = useQueries({
    queries: [
      {
        queryKey: ['space', 'workspaces'],
        queryFn: async () => (await workspaceApi.get('/workspaces')).data as WorkspacesResponse,
        retry: false,
      },
      {
        queryKey: ['space', 'datasets'],
        queryFn: async () => (await workspaceApi.get('/datasets')).data as DatasetsResponse,
        retry: false,
      },
    ],
  });

  const workspacesQuery = results[0];
  const datasetsQuery = results[1];

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const datasets = datasetsQuery.data?.datasets ?? [];

  // Snapshots are per-workspace; fetch in parallel for each.
  const snapshotResults = useQueries({
    queries: workspaces.map((w) => ({
      queryKey: ['space', 'snapshots', w.id],
      queryFn: async () =>
        (await workspaceApi.get(`/workspaces/${w.id}/snapshots`)).data as Snapshot[],
      retry: false,
    })),
  });

  const allSnapshots = snapshotResults.flatMap((r) => r.data ?? []);
  const snapshotsLoading = snapshotResults.some((r) => r.isLoading);

  const totalWorkspaceUsed = workspaces.reduce((s, w) => s + (w.storageUsed ?? 0), 0);
  const totalWorkspaceQuota = workspaces.reduce((s, w) => s + (w.storageLimit ?? 0), 0);
  const totalDatasetBytes = datasets.reduce((s, d) => s + (d.sizeBytes ?? 0), 0);
  const totalSnapshotBytes = allSnapshots.reduce((s, sn) => s + (sn.sizeBytes ?? 0), 0);
  const grandTotal = totalWorkspaceUsed + totalDatasetBytes + totalSnapshotBytes;

  const breakdown = grandTotal > 0
    ? [
        { label: 'Workspaces', bytes: totalWorkspaceUsed, color: 'bg-sky-500' },
        { label: 'Datasets', bytes: totalDatasetBytes, color: 'bg-emerald-500' },
        { label: 'Snapshots', bytes: totalSnapshotBytes, color: 'bg-amber-500' },
      ]
    : [];

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Boxes className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Space</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Where your stuff lives: workspace files, datasets, and snapshots. Numbers are
            tracked-bytes; the actual on-disk footprint may differ slightly.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total storage used
            </div>
            <div className="mt-1 text-3xl font-semibold text-foreground">
              {formatBytes(grandTotal)}
            </div>
          </div>
          {totalWorkspaceQuota > 0 ? (
            <div className="text-xs text-muted-foreground">
              Workspace quota: {formatBytes(totalWorkspaceUsed)} of {formatBytes(totalWorkspaceQuota)} (
              {Math.round((totalWorkspaceUsed / totalWorkspaceQuota) * 100)}%)
            </div>
          ) : null}
        </div>

        {breakdown.length > 0 ? (
          <>
            <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {breakdown.map((seg) => (
                <div
                  key={seg.label}
                  className={seg.color}
                  style={{ width: `${(seg.bytes / grandTotal) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              {breakdown.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                  <span className="text-muted-foreground">{seg.label}</span>
                  <span className="font-medium text-foreground">{formatBytes(seg.bytes)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No tracked storage yet. Create a workspace, import a dataset, or take a snapshot.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Workspaces</h2>
            </div>
            <Link
              href="/workspaces"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open →
            </Link>
          </div>
          {workspacesQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : workspaces.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No workspaces yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {workspaces.map((w) => {
                const pct = w.storageLimit > 0 ? (w.storageUsed / w.storageLimit) * 100 : 0;
                return (
                  <li key={w.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/workspace/${w.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {w.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(w.storageUsed)} / {formatBytes(w.storageLimit)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-sky-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Datasets</h2>
            </div>
            <Link
              href="/datasets"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open →
            </Link>
          </div>
          {datasetsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : datasets.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No datasets imported.</div>
          ) : (
            <ul className="divide-y divide-border">
              {datasets.slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.format.toUpperCase()}
                      {d.rowCount != null ? ` · ${d.rowCount.toLocaleString()} rows` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(d.sizeBytes ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Snapshots</h2>
            </div>
            <Link
              href="/snapshots"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage →
            </Link>
          </div>
          {snapshotsLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : allSnapshots.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No snapshots taken yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {allSnapshots
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((sn) => {
                  const ws = workspaces.find((w) => w.id === sn.workspaceId);
                  return (
                    <li
                      key={sn.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {ws?.name ?? sn.workspaceId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(sn.createdAt)} · {sn.status}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(sn.sizeBytes ?? 0)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <HardDrive className="h-3.5 w-3.5" />
        Files live in S3/MinIO; database rows track sizes per write/import.{' '}
        <Link href="/computer" className="ml-1 inline-flex items-center hover:text-foreground">
          Live runtime view <ArrowRight className="ml-0.5 h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}
