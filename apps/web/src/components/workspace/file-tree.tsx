'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, File as FileIcon, Folder, FolderOpen, Pencil, Trash, Download, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { workspaceApi, toastApiError} from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspaceStore, WorkspaceFileMetadata } from '@/store/workspace';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type FilesResponse = {
  files: WorkspaceFileMetadata[];
};

export default function FileTree({ workspaceId }: { workspaceId: string }) {
  const { selectedItem } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `/${file.name}`);

      await workspaceApi.post(`/workspaces/${workspaceId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-files', workspaceId] });
      toast.success('Dosya yüklendi');
    },
    onError: (err) => {
      toastApiError(err, 'Failed to upload file');
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach((file) => {
          uploadMutation.mutate(file);
        });
      }
    },
    [uploadMutation]
  );

  return (
    <div 
      className={cn(
        "flex h-full flex-col text-sm transition-colors",
        isDragging && "bg-primary/5 ring-1 ring-inset ring-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-10 items-center px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Gezgin
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="rounded-xl border border-primary/20 bg-card p-4 text-center shadow-lg">
              <Download className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-sm font-medium">Yüklemek için dosyaları bırakın</p>
            </div>
          </div>
        )}
        <TreeBranch workspaceId={workspaceId} path="/" level={0} />
      </div>
      <div className="border-t border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detaylar</p>
        {selectedItem ? (
          <dl className="space-y-1.5 text-xs">
            <div>
              <dt className="text-muted-foreground">Ad</dt>
              <dd className="truncate text-foreground">{selectedItem.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Yol</dt>
              <dd className="truncate text-foreground">{selectedItem.path}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-muted-foreground">Tür</dt>
                <dd className="text-foreground">{selectedItem.isDirectory ? 'Klasör' : selectedItem.mimeType || 'Dosya'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Boyut</dt>
                <dd className="text-foreground">{selectedItem.isDirectory ? '-' : formatBytes(selectedItem.size)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-muted-foreground">Güncellendi</dt>
              <dd className="text-foreground">{formatDate(selectedItem.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">İncelemek için dosya veya klasör seçin.</p>
        )}
      </div>
    </div>
  );
}

function TreeBranch({ workspaceId, path, level }: { workspaceId: string; path: string; level: number }) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceFileMetadata | null>(null);
  const { selectedItem, setSelectedFile, addOpenFile, setSelectedItem, removeOpenFile } = useWorkspaceStore();
  const { setIsOpen, setActiveWorkspaceId } = useChatPanel();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-files', workspaceId, path],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces/' + workspaceId + '/files', { params: { path } });
      return res.data as FilesResponse;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
      // filePath has form '/foo/bar baz.txt'. Encode each segment so spaces,
      // '#', '?' and unicode survive the URL while preserving slashes.
      const encoded = filePath
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      await workspaceApi.delete(`/workspaces/${workspaceId}/files${encoded}`);
    },
    onSuccess: (_, filePath) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-files', workspaceId] });
      toast.success('Silindi');
      removeOpenFile(filePath);
      if (selectedItem?.path === filePath) {
        setSelectedItem(null);
      }
    },
    onError: (err) => {
      toastApiError(err, 'Failed to delete file');
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
    return (
      <div className={cn('py-1 pr-2 text-xs text-muted-foreground flex flex-col gap-2', indentClass(level))}>
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted"></div>
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted"></div>
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted"></div>
      </div>
    );
  }

  if (isError) {
    return <div className={cn('py-1 pr-2 text-xs text-destructive', indentClass(level))}>Dosyalar yüklenemedi.</div>;
  }

  if (files.length === 0 && level === 0) {
    return <div className="px-4 py-2 text-xs text-muted-foreground">Bu çalışma alanında dosya yok.</div>;
  }

  return (
    <>
      <ul className="space-y-0.5 px-1.5">
        {files.map((file) => {
          const isExpanded = expandedPaths.has(file.path);
          const isSelected = selectedItem?.path === file.path;

          return (
            <ContextMenu key={file.path}>
              <ContextMenuTrigger>
                <li>
                  <button
                    type="button"
                    draggable={!file.isDirectory}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-workspace-file', JSON.stringify({
                        path: file.path,
                        name: file.name,
                        size: file.size,
                        workspaceId,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={cn(
                      'flex h-9 w-full items-center rounded-md pr-2 text-left text-sm transition-colors md:h-7',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:bg-muted',
                      indentClass(level),
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
                          <FolderOpen className="mr-1.5 h-4 w-4 text-primary" />
                        ) : (
                          <Folder className="mr-1.5 h-4 w-4 text-primary" />
                        )}
                      </>
                    ) : (
                      <FileIcon className="ml-5 mr-1.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </button>
                  {file.isDirectory && isExpanded && (
                    <TreeBranch workspaceId={workspaceId} path={file.path} level={level + 1} />
                  )}
                </li>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                {!file.isDirectory && (
                  <ContextMenuItem onClick={() => openFile(file)}>
                    <Pencil className="mr-2 h-4 w-4" /> Düzenle
                  </ContextMenuItem>
                )}
                {!file.isDirectory && (
                  <ContextMenuItem
                    onClick={() => {
                      setActiveWorkspaceId(workspaceId);
                      window.dispatchEvent(
                        new CustomEvent('app:attach-file-to-chat', {
                          detail: {
                            path: file.path,
                            name: file.name,
                            size: file.size,
                            type: file.mimeType ?? undefined,
                          },
                        }),
                      );
                      setIsOpen(true);
                      toast.success(`"${file.name}" sohbete eklendi`);
                    }}
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4" /> Chat&apos;e ekle
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem disabled>
                  <Pencil className="mr-2 h-4 w-4" /> Yeniden adlandır
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                  onClick={() => setDeleteTarget(file)}
                >
                  <Trash className="mr-2 h-4 w-4" /> Sil
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Dosyayı sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`
            : undefined
        }
        confirmLabel="Sil"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await deleteMutation.mutateAsync(deleteTarget.path);
        }}
      />
    </>
  );
}

function indentClass(level: number) {
  const classes = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-14', 'pl-16'];
  return classes[Math.min(level, classes.length - 1)];
}
