'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe2, RefreshCw, Rocket, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { WorkspaceSummary } from '@/components/workspace/create-workspace-dialog';
import { getApiErrorMessage, publishApi, workspaceApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useUser } from '@/lib/auth';

type PublishedApp = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  subdomain: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
  page: number;
  limit: number;
};

export default function HostingPage() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const appsQuery = useQuery({
    queryKey: ['published-apps', user?.id],
    enabled: Boolean(user?.id),
    retry: false,
    queryFn: async () => {
      const res = await publishApi.get('/apps', { params: { userId: user?.id } });
      return res.data as PublishedApp[];
    },
  });

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const apps = appsQuery.data ?? [];
  const hostingReady = Boolean(user?.id && !appsQuery.isError);
  const defaultWorkspaceId = workspaceId || workspaces[0]?.id || '';

  const workspaceNameById = useMemo(() => {
    return new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  }, [workspaces]);

  const createApp = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('You must be signed in.');
      const res = await publishApi.post('/apps', {
        userId: user.id,
        workspaceId: defaultWorkspaceId,
        name: name.trim(),
        subdomain: normalizeSubdomain(subdomain || name),
      });
      return res.data as PublishedApp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-apps', user?.id] });
      toast.success('Site created.');
      setShowCreate(false);
      setName('');
      setSubdomain('');
      setWorkspaceId('');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Could not create site.'));
    },
  });

  const deployApp = useMutation({
    mutationFn: async (appId: string) => {
      const version = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const res = await publishApi.post(`/apps/${appId}/deploy`, { version });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Deployment started.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Could not start deployment.'));
    },
  });

  const canCreate = hostingReady && Boolean(defaultWorkspaceId && name.trim());

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Hosting</h2>
          <p className="text-sm text-muted-foreground">Deploy workspace apps as hosted services</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} disabled={!hostingReady || workspaces.length === 0}>
          <Rocket className="mr-1.5 h-3.5 w-3.5" />
          Create site
        </Button>
      </div>

      {appsQuery.isError && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
          Publish service is not available. Hosting actions are disabled until it responds.
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (canCreate) createApp.mutate(); }}
          className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Site name</Label>
            <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My App" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subdomain">Subdomain</Label>
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder={normalizeSubdomain(name || 'my-app')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="workspace">Workspace</Label>
            <select
              id="workspace"
              value={defaultWorkspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={!canCreate || createApp.isPending}>
            {createApp.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {appsQuery.isLoading ? (
          <LoadingSkeleton variant="card" />
        ) : apps.length > 0 ? (
          <div className="space-y-3">
            {apps.map((app) => (
              <div key={app.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{app.name}</h3>
                      <StatusBadge variant={app.status === 'running' ? 'running' : 'stopped'} dot>
                        {app.status}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {app.subdomain}.apps.platform.com · {workspaceNameById.get(app.workspaceId) || 'Workspace'} · {formatDate(app.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => deployApp.mutate(app.id)} disabled={!hostingReady || deployApp.isPending}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Deploy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<a href={`http://${app.subdomain}.apps.platform.com`} target="_blank" rel="noreferrer" />}
                  >
                    Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Globe2 className="h-6 w-6" />}
            title="No sites yet"
            description="Create a site from an existing workspace."
            action={{
              label: 'Create site',
              onClick: () => setShowCreate(true),
            }}
          />
        )}
      </div>
    </div>
  );
}

function normalizeSubdomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
