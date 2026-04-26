'use client';

import { useMemo } from 'react';
import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowRight, Bot, FileText, FolderKanban, Rocket, Server, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateWorkspaceDialog, WorkspaceSummary } from '@/components/workspace/create-workspace-dialog';
import { workspaceApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import { useUser } from '@/lib/auth';

type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
  page: number;
  limit: number;
};

export default function DashboardPage() {
  const { data: user } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = data?.workspaces ?? [];
  const latestWorkspace = workspaces[0];
  const storageUsed = useMemo(() => workspaces.reduce((total, workspace) => total + workspace.storageUsed, 0), [workspaces]);
  const storageLimit = useMemo(
    () => workspaces.reduce((total, workspace) => total + workspace.storageLimit, 0),
    [workspaces]
  );

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Good morning, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Start a workspace, inspect files, ask the agent, or publish a site from one focused control surface.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Workspaces</p>
          <p className="mt-2 text-2xl font-semibold">{isLoading ? '...' : workspaces.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Storage used</p>
          <p className="mt-2 text-2xl font-semibold">{formatBytes(storageUsed)}</p>
          <p className="mt-1 text-xs text-zinc-500">{storageLimit > 0 ? `${formatBytes(storageLimit)} available` : 'No quota yet'}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Next action</p>
          <p className="mt-2 text-2xl font-semibold">{latestWorkspace ? 'Open files' : 'Create workspace'}</p>
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Start here</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800 md:grid-cols-4 md:divide-x md:divide-y-0">
          <QuickStep
            icon={FolderKanban}
            title="Create workspace"
            description="Generate a starter README and source folder."
            action={<CreateWorkspaceDialog trigger={<Button variant="outline">Create</Button>} />}
          />
          <QuickStep
            icon={FileText}
            title="Open files"
            description="Browse metadata and preview text files."
            action={
              latestWorkspace ? (
                <Button render={<Link href={`/workspace/${latestWorkspace.id}`} />} variant="outline">
                  Open
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Open
                </Button>
              )
            }
          />
          <QuickStep
            icon={Bot}
            title="Ask agent"
            description="Send a task from the workspace chat panel."
            action={
              latestWorkspace ? (
                <Button render={<Link href={`/workspace/${latestWorkspace.id}`} />} variant="outline">
                  Ask
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Ask
                </Button>
              )
            }
          />
          <QuickStep
            icon={Rocket}
            title="Publish app"
            description="Create a site record from Hosting."
            action={
              <Button render={<Link href="/hosting" />} variant="outline">
                Publish
              </Button>
            }
          />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Recent workspaces</h2>
          <Link href="/workspaces" className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">Loading workspaces...</div>
        ) : workspaces.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {workspaces.slice(0, 4).map((workspace) => (
              <li key={workspace.id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{workspace.name}</p>
                    <p className="text-sm text-zinc-500">Updated {formatDate(workspace.updatedAt)}</p>
                  </div>
                </div>
                <Button render={<Link href={`/workspace/${workspace.id}`} />}>
                  Open <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center gap-3 text-center text-zinc-500">
            <Sparkles className="h-8 w-8 text-zinc-400" />
            <div>
              <p className="font-medium text-zinc-700 dark:text-zinc-200">No workspaces yet</p>
              <p className="text-sm">Create one to unlock files, terminal, chat, and hosting.</p>
            </div>
            <CreateWorkspaceDialog trigger={<Button>Create workspace</Button>} />
          </div>
        )}
      </section>
    </div>
  );
}

function QuickStep({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-44 flex-col justify-between gap-4 p-5">
      <div>
        <Icon className="mb-4 h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}
