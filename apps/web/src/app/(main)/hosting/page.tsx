'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Globe2,
  Play,
  RefreshCw,
  Rocket,
  Server,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkspaceSummary } from '@/components/workspace/create-workspace-dialog';
import {publishApi, workspaceApi , toastApiError} from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useUser } from '@/lib/auth';

type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
  page: number;
  limit: number;
};

type HostedService = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: string;
  kind: string;
  updatedAt: string;
  publicUrl?: string | null;
  autoRestart?: boolean;
  crashCount?: number;
  lastHealthAt?: string | null;
  lastHealthOk?: boolean | null;
};

export default function HostingPage() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState('static');
  const [rootPath, setRootPath] = useState('/');
  const [workspaceId, setWorkspaceId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = useMemo(
    () => workspacesQuery.data?.workspaces ?? [],
    [workspacesQuery.data],
  );
  const defaultWorkspaceId = workspaceId || workspaces[0]?.id || '';

  const servicesQuery = useQuery({
    queryKey: ['hosted-services', defaultWorkspaceId],
    enabled: Boolean(user?.id && defaultWorkspaceId),
    retry: false,
    refetchInterval: 20_000,
    queryFn: async () => {
      const res = await publishApi.get('/hosted-services', {
        params: { workspaceId: defaultWorkspaceId },
      });
      return res.data as HostedService[];
    },
  });

  const services = servicesQuery.data ?? [];
  const hostingReady = Boolean(user?.id && !servicesQuery.isError);

  const workspaceNameById = useMemo(() => {
    return new Map(workspaces.map((w) => [w.id, w.name]));
  }, [workspaces]);

  const createService = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('You must be signed in.');
      await publishApi.post('/hosted-services', {
        workspaceId: defaultWorkspaceId,
        name: name.trim(),
        slug: normalizeSlug(slug || name),
        kind,
        rootPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Service created.');
      setShowCreate(false);
      setName('');
      setSlug('');
      setKind('static');
      setRootPath('/');
    },
    onError: (e) => toastApiError(e, 'Could not create service.'),
  });

  const startService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Service starting...');
    },
    onError: (e) => toastApiError(e, 'Could not start service.'),
  });

  const stopService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Service stopped.');
    },
    onError: (e) => toastApiError(e, 'Could not stop service.'),
  });

  const restartService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/restart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Service restarting...');
    },
    onError: (e) => toastApiError(e, 'Could not restart service.'),
  });

  const updateAutoRestart = useMutation({
    mutationFn: async ({ id, autoRestart }: { id: string; autoRestart: boolean }) => {
      await publishApi.patch(`/hosted-services/${id}`, { autoRestart });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
    },
    onError: (e) => toastApiError(e, 'Could not update service.'),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.delete(`/hosted-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Service deleted.');
      setDeleteTarget(null);
    },
    onError: (e) => toastApiError(e, 'Could not delete service.'),
  });

  const canCreate = hostingReady && Boolean(defaultWorkspaceId && name.trim());

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Hosting</h2>
          <p className="text-sm text-muted-foreground">Deploy workspace apps as hosted services</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate((v) => !v)}
          disabled={!hostingReady || workspaces.length === 0}
        >
          <Rocket className="mr-1.5 h-3.5 w-3.5" />
          Create service
        </Button>
      </div>

      {servicesQuery.isError && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
          Publish service is not available. Hosting actions are disabled until it responds.
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) createService.mutate();
          }}
          className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Service name</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My App"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-slug">Slug (subdomain)</Label>
            <Input
              id="svc-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={normalizeSlug(name || 'my-app')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-kind">Kind</Label>
            <select
              id="svc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="static">Static (HTML/CSS/JS)</option>
              <option value="vite">Vite App</option>
              <option value="node">Node.js API</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-root">Root path</Label>
            <Input
              id="svc-root"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-workspace">Workspace</Label>
            <select
              id="svc-workspace"
              value={defaultWorkspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" disabled={!canCreate || createService.isPending}>
              {createService.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {servicesQuery.isLoading ? (
          <LoadingSkeleton variant="card" />
        ) : services.length > 0 ? (
          <div className="space-y-3">
            {services.map((svc) => {
              const isRunning = svc.status === 'running';
              const isStarting = svc.status === 'starting';
              return (
                <div
                  key={svc.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{svc.name}</h3>
                        <StatusBadge
                          variant={isRunning ? 'running' : isStarting ? 'pending' : 'stopped'}
                          dot
                        >
                          {svc.status}
                        </StatusBadge>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {svc.kind}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {svc.slug}.apps.localhost ·{' '}
                        {workspaceNameById.get(svc.workspaceId) || 'Workspace'} ·{' '}
                        {formatDate(svc.updatedAt)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span
                          className={
                            svc.lastHealthOk === false
                              ? 'text-destructive'
                              : svc.lastHealthOk
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : ''
                          }
                          title={svc.lastHealthAt ?? undefined}
                        >
                          Health:{' '}
                          {svc.lastHealthOk === null || svc.lastHealthOk === undefined
                            ? '—'
                            : svc.lastHealthOk
                              ? 'OK'
                              : 'failing'}
                        </span>
                        <span>Crashes: {svc.crashCount ?? 0}</span>
                        <label className="flex cursor-pointer items-center gap-1">
                          <input
                            type="checkbox"
                            checked={svc.autoRestart ?? true}
                            onChange={(e) =>
                              updateAutoRestart.mutate({
                                id: svc.id,
                                autoRestart: e.target.checked,
                              })
                            }
                            className="h-3 w-3"
                          />
                          Auto-restart
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isRunning ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restartService.mutate(svc.id)}
                          disabled={restartService.isPending}
                          title="Restart"
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restart
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopService.mutate(svc.id)}
                          disabled={stopService.isPending}
                        >
                          <Square className="mr-1 h-3.5 w-3.5" /> Stop
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startService.mutate(svc.id)}
                        disabled={startService.isPending || isStarting}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Start
                      </Button>
                    )}
                    {svc.publicUrl && (
                      <a href={svc.publicUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                          Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(svc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Globe2 className="h-6 w-6" />}
            title="No services yet"
            description="Create a static site, Vite app, or Node.js service from an existing workspace."
            action={{
              label: 'Create service',
              onClick: () => setShowCreate(true),
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete service"
        description="This will stop the running container and remove the service. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await deleteService.mutateAsync(deleteTarget);
        }}
      />
    </div>
  );
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
