'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, Rocket, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hosting</h1>
          <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Create site records and deploy workspace apps when the publish service is online.
          </p>
        </div>
        <Button onClick={() => setShowCreate((value) => !value)} disabled={!hostingReady || workspaces.length === 0}>
          <Rocket className="mr-1 h-4 w-4" />
          Create site
        </Button>
      </header>

      {appsQuery.isError && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Publish service is not available at the configured endpoint. Hosting actions are disabled until it responds.
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canCreate) createApp.mutate();
          }}
          className="mb-6 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="site-name">Site name</Label>
            <Input id="site-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Docs app" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(event) => setSubdomain(event.target.value)}
              placeholder={normalizeSubdomain(name || 'docs-app')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace</Label>
            <select
              id="workspace"
              value={defaultWorkspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-background px-3 text-sm dark:border-zinc-800"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!canCreate || createApp.isPending}>
            {createApp.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {appsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-zinc-500">Loading sites...</div>
        ) : apps.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {apps.map((app) => (
              <li key={app.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{app.name}</h2>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {app.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {app.subdomain}.apps.platform.com · {workspaceNameById.get(app.workspaceId) || 'Workspace'} · Updated{' '}
                      {formatDate(app.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deployApp.mutate(app.id)}
                    disabled={!hostingReady || deployApp.isPending}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Deploy
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    render={<a href={`http://${app.subdomain}.apps.platform.com`} target="_blank" rel="noreferrer" />}
                    variant="outline"
                    size="sm"
                  >
                    Open <ExternalLink className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-4 text-center">
            <Rocket className="h-10 w-10 text-zinc-400" />
            <div>
              <h2 className="font-semibold">No sites yet</h2>
              <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                Create a site from an existing workspace. Deploy controls activate when the publish service is reachable.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} disabled={!hostingReady || workspaces.length === 0}>
              Create site
            </Button>
          </div>
        )}
      </section>
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
