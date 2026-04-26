'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowRight, FolderKanban, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateWorkspaceDialog, WorkspaceSummary } from '@/components/workspace/create-workspace-dialog';
import { workspaceApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';

type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
  page: number;
  limit: number;
};

export default function WorkspacesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Persistent environments with files, terminal access, and agent context.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-zinc-500">Loading workspaces...</div>
        ) : workspaces.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {workspaces.map((workspace) => (
              <li key={workspace.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{workspace.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>{formatBytes(workspace.storageUsed)} used</span>
                      <span>{formatBytes(workspace.storageLimit)} quota</span>
                      <span>Updated {formatDate(workspace.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <Button render={<Link href={`/workspace/${workspace.id}`} />}>
                  Open <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-4 text-center">
            <FolderKanban className="h-10 w-10 text-zinc-400" />
            <div>
              <h2 className="font-semibold">Create your first workspace</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                The starter workspace includes files that can be previewed immediately.
              </p>
            </div>
            <CreateWorkspaceDialog trigger={<Button>Create workspace</Button>} />
          </div>
        )}
      </section>
    </div>
  );
}
