'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import FileTree from '@/components/workspace/file-tree';
import WorkspaceEditor from '@/components/workspace/editor';
import { workspaceApi } from '@/lib/api';
import { useWorkspaceStore } from '@/store/workspace';

type WorkspaceSummary = { id: string; name: string };
type WorkspacesResponse = { workspaces: WorkspaceSummary[] };

export default function FilesPage() {
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);

  // Auto-select first workspace
  useEffect(() => {
    if (!currentWorkspaceId && workspaces.length > 0 && workspaces[0]) {
      setCurrentWorkspaceId(workspaces[0].id);
    }
  }, [currentWorkspaceId, workspaces, setCurrentWorkspaceId]);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<FolderPlus className="h-6 w-6" />}
        title="Dosyalar yüklenemedi"
        description="Çalışma alanları alınamadı. Bağlantınızı kontrol edip tekrar deneyin."
      />
    );
  }

  if (workspaces.length === 0) {
    return (
      <EmptyState
        icon={<FolderPlus className="h-6 w-6" />}
        title="No workspace found"
        description="Create a workspace to start managing your files."
      />
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col lg:flex-row">
      {/* File Tree Sidebar */}
      <div className="h-[42dvh] shrink-0 border-b border-border/60 bg-card/60 backdrop-blur-md lg:h-auto lg:w-64 lg:border-b-0 lg:border-r">
        {currentWorkspaceId && <FileTree workspaceId={currentWorkspaceId} />}
      </div>

      {/* Editor / Preview Area */}
      <div className="min-h-0 min-w-0 flex-1">
        {currentWorkspaceId ? (
          <WorkspaceEditor />
        ) : (
          <EmptyState
            icon={<FolderPlus className="h-6 w-6" />}
            title="Select a workspace"
            description="Choose a workspace from the sidebar to browse files."
          />
        )}
      </div>
    </div>
  );
}
