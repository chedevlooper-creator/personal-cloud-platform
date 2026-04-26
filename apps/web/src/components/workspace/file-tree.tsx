'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import { workspaceApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspaceStore, WorkspaceFileMetadata } from '@/store/workspace';

type FilesResponse = {
  files: WorkspaceFileMetadata[];
};

export default function FileTree({ workspaceId }: { workspaceId: string }) {
  const { selectedItem } = useWorkspaceStore();

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex h-10 items-center px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Explorer
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        <TreeBranch workspaceId={workspaceId} path="/" level={0} />
      </div>
      <div className="border-t border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
        {selectedItem ? (
          <dl className="space-y-1.5 text-xs">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="truncate text-foreground">{selectedItem.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="truncate text-foreground">{selectedItem.path}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-foreground">{selectedItem.isDirectory ? 'Folder' : selectedItem.mimeType || 'File'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="text-foreground">{selectedItem.isDirectory ? '-' : formatBytes(selectedItem.size)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="text-foreground">{formatDate(selectedItem.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Select a file or folder to inspect.</p>
        )}
      </div>
    </div>
  );
}

function TreeBranch({ workspaceId, path, level }: { workspaceId: string; path: string; level: number }) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const { selectedItem, setSelectedFile, addOpenFile, setSelectedItem } = useWorkspaceStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-files', workspaceId, path],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces/' + workspaceId + '/files', { params: { path } });
      return res.data as FilesResponse;
    },
  });

  const files = useMemo(() => {
    return [...(data?.files ?? [])].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data?.files]);

  const toggleDirectory = (file: WorkspaceFileMetadata) => {
    setSelectedItem(file);
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.add(file.path);
      }
      return next;
    });
  };

  const openFile = (file: WorkspaceFileMetadata) => {
    setSelectedItem(file);
    setSelectedFile(file.path);
    addOpenFile(file.path);
  };

  if (isLoading) {
    return <div className={cn('py-1 pr-2 text-xs text-muted-foreground', indentClass(level))}>Loading...</div>;
  }

  if (isError) {
    return <div className={cn('py-1 pr-2 text-xs text-destructive', indentClass(level))}>Could not load files.</div>;
  }

  if (files.length === 0 && level === 0) {
    return <div className="px-4 py-2 text-xs text-muted-foreground">No files in this workspace.</div>;
  }

  return (
    <ul className="space-y-0.5 px-1.5">
      {files.map((file) => {
        const isExpanded = expandedPaths.has(file.path);
        const isSelected = selectedItem?.path === file.path;

        return (
          <li key={file.path}>
            <button
              type="button"
              className={cn(
                'flex h-7 w-full items-center rounded-md pr-2 text-left text-sm transition-colors',
                isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/80 hover:bg-muted',
                indentClass(level)
              )}
              onClick={() => (file.isDirectory ? toggleDirectory(file) : openFile(file))}
            >
              {file.isDirectory ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="mr-1.5 h-4 w-4 text-blue-500" />
                  ) : (
                    <Folder className="mr-1.5 h-4 w-4 text-blue-500" />
                  )}
                </>
              ) : (
                <File className="ml-5 mr-1.5 h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate">{file.name}</span>
            </button>
            {file.isDirectory && isExpanded && <TreeBranch workspaceId={workspaceId} path={file.path} level={level + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

function indentClass(level: number) {
  const classes = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-14', 'pl-16'];
  return classes[Math.min(level, classes.length - 1)];
}
