'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {workspaceApi , toastApiError} from '@/lib/api';
import { formatDate } from '@/lib/format';

type WorkspacesResponse = {
  workspaces?: { id: string; name: string }[];
};

type Snapshot = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
};

export default function SnapshotsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Snapshot | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  // We need a workspaceId. For now, get user's first workspace.
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
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await workspaceApi.post(`/workspaces/${workspaceId}/snapshots`, { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      toast.success('Snapshot created');
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
      toast.success('Snapshot deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toastApiError(e, 'Failed to delete'),
  });

  const items = snapshots || [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Snapshots</h2>
          <p className="text-sm text-muted-foreground">Backup and restore your workspace</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => setShowCreate((v) => !v)} disabled={!workspaceId}>
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
          <div className="space-y-3">
            {items.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground">{snap.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {snap.description || 'No description'} · {formatDate(snap.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRestoreTarget(snap)}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteTarget(snap)}
                    aria-label="Delete snapshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Camera className="h-6 w-6" />}
            title="No snapshots yet"
            description="Create a snapshot to backup your current workspace state. You can restore it anytime."
            action={{
              label: 'Create first snapshot',
              onClick: () => setShowCreate(true),
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={() => setRestoreTarget(null)}
        title="Restore snapshot"
        description={`This will overwrite your current workspace with "${restoreTarget?.name}". A safety backup will be created automatically before the restore begins. This cannot be undone.`}
        confirmLabel="Yes, restore"
        variant="destructive"
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
