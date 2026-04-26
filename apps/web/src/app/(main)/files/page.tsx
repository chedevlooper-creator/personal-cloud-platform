'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import FileTree from '@/components/workspace/file-tree';
import WorkspaceEditor from '@/components/workspace/editor';
import { workspaceApi } from '@/lib/api';
import { useWorkspaceStore } from '@/store/workspace';

type WorkspaceSummary = { id: string; name: string };
type WorkspacesResponse = { workspaces: WorkspaceSummary[] };

export default function FilesPage() {
  const { currentWorkspaceId, setCurrentWorkspaceId, selectedFile } = useWorkspaceStore();

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = data?.workspaces ?? [];

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
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        {currentWorkspaceId && <FileTree workspaceId={currentWorkspaceId} />}
      </div>

      {/* Editor / Preview Area */}
      <div className="min-w-0 flex-1">
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
