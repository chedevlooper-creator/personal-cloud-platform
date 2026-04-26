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
      <div className="flex h-8 items-center px-4 font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Explorer
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <TreeBranch workspaceId={workspaceId} path="/" level={0} />
      </div>
      <div className="border-t border-[#333333] bg-[#252526] p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Details</p>
        {selectedItem ? (
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-zinc-500">Name</dt>
              <dd className="truncate text-zinc-300">{selectedItem.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Path</dt>
              <dd className="truncate text-zinc-300">{selectedItem.path}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-zinc-500">Type</dt>
                <dd className="text-zinc-300">{selectedItem.isDirectory ? 'Folder' : selectedItem.mimeType || 'File'}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Size</dt>
                <dd className="text-zinc-300">{selectedItem.isDirectory ? '-' : formatBytes(selectedItem.size)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-zinc-500">Updated</dt>
              <dd className="text-zinc-300">{formatDate(selectedItem.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-zinc-500">Select a file or folder to inspect metadata.</p>
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
    return <div className={cn('py-1 pr-2 text-xs text-zinc-500', indentClass(level))}>Loading files...</div>;
  }

  if (isError) {
    return <div className={cn('py-1 pr-2 text-xs text-red-400', indentClass(level))}>Could not load files.</div>;
  }

  if (files.length === 0 && level === 0) {
    return <div className="px-4 py-2 text-xs text-zinc-500">No files in this workspace.</div>;
  }

  return (
    <ul className="space-y-0.5 px-2">
      {files.map((file) => {
        const isExpanded = expandedPaths.has(file.path);
        const isSelected = selectedItem?.path === file.path;

        return (
          <li key={file.path}>
            <button
              type="button"
              className={cn(
                'flex h-7 w-full items-center rounded-md pr-2 text-left transition-colors hover:bg-zinc-700/60',
                isSelected ? 'bg-[#37373d] text-white' : 'text-[#cccccc]',
                indentClass(level)
              )}
              onClick={() => (file.isDirectory ? toggleDirectory(file) : openFile(file))}
            >
              {file.isDirectory ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="mr-1 h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="mr-1 h-4 w-4 text-zinc-400" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="mr-2 h-4 w-4 text-blue-400" />
                  ) : (
                    <Folder className="mr-2 h-4 w-4 text-blue-400" />
                  )}
                </>
              ) : (
                <File className="ml-5 mr-2 h-4 w-4 text-zinc-400" />
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
