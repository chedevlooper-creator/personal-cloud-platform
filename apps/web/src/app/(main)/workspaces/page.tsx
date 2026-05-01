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
    <div className="flex-1 overflow-auto scroll-elegant p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Workspaces
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Persistent environments with files, terminal access, and agent context.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </header>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-[0_4px_24px_-12px_color-mix(in_oklch,var(--foreground)_15%,transparent)]">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">Loading workspaces...</div>
        ) : workspaces.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {workspaces.map((workspace, idx) => (
              <li
                key={workspace.id}
                style={{ animationDelay: `${idx * 40}ms` }}
                className="group/row grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center transition-colors hover:bg-muted/30 animate-fade-up"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent text-primary ring-1 ring-primary/15 transition-transform group-hover/row:scale-105">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-foreground">{workspace.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatBytes(workspace.storageUsed)} used</span>
                      <span>{formatBytes(workspace.storageLimit)} quota</span>
                      <span>Updated {formatDate(workspace.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" render={<Link href={`/workspace/${workspace.id}`} />}>
                  Open <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover/row:translate-x-0.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-4 text-center animate-fade-up">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent text-primary ring-1 ring-primary/15">
              <FolderKanban className="h-7 w-7" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Create your first workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The starter workspace includes files that can be previewed immediately.
              </p>
            </div>
            <CreateWorkspaceDialog trigger={<Button variant="gradient">Create workspace</Button>} />
          </div>
        )}
      </section>
    </div>
  );
}
