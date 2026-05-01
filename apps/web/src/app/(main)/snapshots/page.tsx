'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { workspaceApi, toastApiError } from '@/lib/api';
import { formatBytes } from '@/lib/format';

type WorkspacesResponse = {
  workspaces?: { id: string; name: string }[];
};

type Snapshot = {
  id: string;
  name: string;
  description?: string | null;
  status: 'creating' | 'ready' | 'failed' | 'restoring';
  error?: string | null;
  fileCount?: number | null;
  sizeBytes?: string | null;
  kind?: string;
  createdAt: string;
};

type SnapshotUsage = {
  totalBytes: number;
  count: number;
};

const STATUS_POLL_INTERVAL = 3000;
const SNAPSHOT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB

function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  if (status === 'creating') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Creating…
      </span>
    );
  }
  if (status === 'restoring') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-600">
        <Loader2 className="h-3 w-3 animate-spin" /> Restoring…
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-destructive" title={error ?? ''}>
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> Ready
    </span>
  );
}

function groupByDay(snapshots: Snapshot[]): Array<{ label: string; snapshots: Snapshot[] }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 86400000 * 7);

  const groups: Record<string, Snapshot[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const snap of snapshots) {
    const d = new Date(snap.createdAt);
    if (d >= todayStart) groups['Today'].push(snap);
    else if (d >= yesterdayStart) groups['Yesterday'].push(snap);
    else if (d >= weekStart) groups['This Week'].push(snap);
    else groups['Older'].push(snap);
  }

  return Object.entries(groups)
    .filter(([, snaps]) => snaps.length > 0)
    .map(([label, snapshots]) => ({ label, snapshots }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SnapshotsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: wsData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const allWorkspaces = wsData?.workspaces ?? [];
  const workspaceId = selectedWorkspaceId ?? allWorkspaces[0]?.id;

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await workspaceApi.get(`/workspaces/${workspaceId}/snapshots`);
      return (res.data as { snapshots: Snapshot[] }).snapshots;
    },
    refetchInterval: (query) => {
      const snaps = query.state.data as Snapshot[] | undefined;
      const hasCreating = snaps?.some((s) => s.status === 'creating' || s.status === 'restoring');
      return hasCreating ? STATUS_POLL_INTERVAL : false;
    },
  });

  const { data: usage } = useQuery<SnapshotUsage>({
    queryKey: ['snapshot-usage'],
    queryFn: async () => {
      const res = await workspaceApi.get('/snapshots/usage');
      return res.data as SnapshotUsage;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await workspaceApi.post(`/workspaces/${workspaceId}/snapshots`, { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['snapshot-usage'] });
      toast.success('Snapshot creation started');
      setShowCreate(false);
      setName('');
      setDescription('');
    },
    onError: (e) => toastApiError(e, 'Failed to create snapshot'),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await workspaceApi.post(`/snapshots/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      toast.success('Snapshot restored. A safety backup was created.');
      setRestoreTarget(null);
    },
    onError: (e) => toastApiError(e, 'Failed to restore'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await workspaceApi.delete(`/snapshots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['snapshot-usage'] });
      toast.success('Snapshot deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toastApiError(e, 'Failed to delete'),
  });

  const handleDownload = async (snap: Snapshot) => {
    setDownloadingId(snap.id);
    try {
      const res = await workspaceApi.get(`/snapshots/${snap.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${snap.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (e) {
      toastApiError(e, 'Failed to download snapshot');
    } finally {
      setDownloadingId(null);
    }
  };

  const items = snapshots || [];
  const hasCreating = items.some((s) => s.status === 'creating' || s.status === 'restoring');
  const grouped = groupByDay(items);
  const usagePct = usage ? (usage.totalBytes / SNAPSHOT_STORAGE_LIMIT) * 100 : 0;
  const usageHigh = usagePct > 80;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Snapshots</h2>
          <p className="text-sm text-muted-foreground">Backup and restore your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          {usage && (
            <div className="hidden sm:block text-right">
              <p className={`text-xs ${usageHigh ? 'text-amber-600' : 'text-muted-foreground'}`}>
                Using {formatBytes(usage.totalBytes)} of {formatBytes(SNAPSHOT_STORAGE_LIMIT)}
              </p>
              <div className="mt-1 h-1 w-32 rounded-full bg-muted">
                <div
                  className={`h-1 rounded-full transition-all ${usageHigh ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(usagePct, 100)}%` }}
                />
              </div>
            </div>
          )}
          {allWorkspaces.length > 1 ? (
            <select
              value={workspaceId ?? ''}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Workspace"
            >
              {allWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button size="sm" onClick={() => setShowCreate((v) => !v)} disabled={!workspaceId || hasCreating}>
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Create Snapshot
          </Button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMutation.mutate();
          }}
          className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="snap-name">Name</Label>
            <Input
              id="snap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Before refactoring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="snap-desc">Description (optional)</Label>
            <Input
              id="snap-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about this state..."
            />
          </div>
          <Button type="submit" size="sm" disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {isLoading ? (
          <LoadingSkeleton variant="card" />
        ) : items.length > 0 ? (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold sticky top-0 bg-background/95 backdrop-blur-sm py-2 text-foreground">
                  {group.label}
                </h3>
                <div className="border-l border-border pl-6 ml-3 space-y-3">
                  {group.snapshots.map((snap) => (
                    <div key={snap.id} className="relative -ml-[34px]">
                      <div
                        className={`size-3 rounded-full -ml-[34px] mt-1.5 ring-4 ring-background absolute left-0 top-0 ${
                          snap.kind === 'auto-pre-restore' ? 'bg-muted-foreground' : 'bg-primary'
                        }`}
                      />
                      <div className="rounded-lg border border-border bg-card/50 p-4 ml-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {snap.kind === 'auto-pre-restore' ? 'Auto-snapshot' : snap.name}
                              </span>
                              <StatusBadge status={snap.status} error={snap.error} />
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums mt-1">
                              <span className="font-mono">{formatTime(snap.createdAt)}</span>
                              <span>·</span>
                              <span>{snap.description || (snap.kind === 'auto-pre-restore' ? 'Pre-restore backup' : 'Manual snapshot')}</span>
                              {snap.fileCount != null && snap.sizeBytes != null && (
                                <>
                                  <span>·</span>
                                  <span>{formatBytes(Number(snap.sizeBytes))}</span>
                                  <span>·</span>
                                  <span>{snap.fileCount} files</span>
                                </>
                              )}
                              {snap.kind === 'auto-pre-restore' && (
                                <>
                                  <span>·</span>
                                  <span>Auto backup</span>
                                </>
                              )}
                            </div>
                          </div>
                          {snap.status === 'ready' && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                                onClick={() => setRestoreTarget(snap)}
                              >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(snap)}
                                disabled={downloadingId === snap.id}
                              >
                                {downloadingId === snap.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTarget(snap)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                          {snap.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(snap)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Camera className="h-12 w-12 text-muted-foreground" />}
            title="No snapshots yet"
            description="Snapshots let you save and restore your workspace state at any point in time"
            action={{
              label: 'Create Your First Snapshot',
              onClick: () => setShowCreate(true),
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={() => setRestoreTarget(null)}
        title="Restore from snapshot?"
        description={`This will replace your current workspace state with "${restoreTarget?.name}". Your current state will be saved as an automatic snapshot before restore.`}
        confirmLabel="Restore Snapshot"
        variant="warning"
        onConfirm={async () => {
          if (restoreTarget) await restoreMutation.mutateAsync(restoreTarget.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete snapshot"
        description={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
    </div>
  );
}
