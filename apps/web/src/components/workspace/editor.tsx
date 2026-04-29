'use client';

import Editor from '@monaco-editor/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AlertCircle, FileText, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { workspaceApi, toastApiError} from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { useWorkspaceStore } from '@/store/workspace';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';

type FileContentResponse = {
  path: string;
  name: string;
  mimeType: string | null;
  size: number;
  content: string;
  updatedAt: string;
};

type DraftContent = {
  path: string;
  content: string;
};

export default function WorkspaceEditor() {
  const {
    currentWorkspaceId,
    selectedFile,
    selectedItem,
    openFiles,
    setSelectedFile,
    removeOpenFile,
  } = useWorkspaceStore();
  const { resolvedTheme } = useTheme();
  const [draftContent, setDraftContent] = useState<DraftContent | null>(null);

  const {
    data: fileContent,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['file-content', currentWorkspaceId, selectedFile],
    queryFn: async () => {
      const res = await workspaceApi.get(`/workspaces/${currentWorkspaceId}/files/content`, {
        params: { path: selectedFile },
      });
      return res.data as FileContentResponse;
    },
    enabled: Boolean(selectedFile && currentWorkspaceId),
    retry: false,
  });

  const editedContent = draftContent?.path === selectedFile ? draftContent.content : null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspaceId || !selectedFile || editedContent === null) return;
      await workspaceApi.post(`/workspaces/${currentWorkspaceId}/files/write`, {
        path: selectedFile,
        content: editedContent,
        mimeType: 'text/plain',
      });
    },
    onSuccess: () => {
      toast.success('File saved');
      setDraftContent(null);
    },
    onError: (err) => {
      toastApiError(err, 'Failed to save file');
    },
  });

  // Ctrl+S save handler
  const handleSave = useCallback(() => {
    if (editedContent !== null) saveMutation.mutate();
  }, [editedContent, saveMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const hasChanges = editedContent !== null;

  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.go')) return 'go';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.sh') || path.endsWith('.bash')) return 'shell';
    if (path.endsWith('.sql')) return 'sql';
    if (path.endsWith('.xml')) return 'xml';
    return 'plaintext';
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab Bar */}
      {openFiles.length > 0 && (
        <div className="flex h-9 items-end overflow-x-auto border-b border-border bg-card">
          {openFiles.map((file) => (
            <div
              key={file}
              className={cn(
                'group flex h-full min-w-[120px] max-w-[200px] cursor-pointer items-center justify-between border-r border-border px-3 text-xs transition-colors',
                selectedFile === file
                  ? 'bg-background text-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60',
              )}
              onClick={() => setSelectedFile(file)}
            >
              <span className="truncate">{file.split('/').pop()}</span>
              <button
                type="button"
                aria-label={`Close ${file}`}
                className={cn(
                  'ml-2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted',
                  selectedFile === file ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  removeOpenFile(file);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {/* Save indicator */}
          {hasChanges && (
            <Button
              size="xs"
              variant="ghost"
              className="mx-2 text-primary"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-1 h-3 w-3" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="relative flex-1">
        {!selectedFile ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-sm text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Select a file</p>
              <p className="mt-1 text-xs text-muted-foreground">Use the explorer to open files.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : isError ? (
          <PreviewError
            title={selectedItem?.name || selectedFile}
            detail={getPreviewError(error)}
            size={selectedItem?.size}
            mimeType={selectedItem?.mimeType}
          />
        ) : (
          <Editor
            height="100%"
            theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
            path={selectedFile}
            defaultLanguage={getLanguage(selectedFile)}
            value={editedContent ?? fileContent?.content ?? ''}
            onChange={(value) => {
              if (!selectedFile) return;
              setDraftContent(value === undefined ? null : { path: selectedFile, content: value });
            }}
            options={{
              minimap: { enabled: true },
              fontSize: 13,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              readOnly: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
            }}
          />
        )}
      </div>
    </div>
  );
}

function PreviewError({
  title,
  detail,
  size,
  mimeType,
}: {
  title: string;
  detail: string;
  size?: number;
  mimeType?: string | null;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-border bg-card p-6">
        <AlertCircle className="mb-3 h-6 w-6 text-amber-500" />
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="mt-1 text-foreground">{mimeType || 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="mt-1 text-foreground">{size === undefined ? '-' : formatBytes(size)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function getPreviewError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } })
      .response;
    return response?.data?.error || response?.data?.message || 'This file cannot be previewed.';
  }

  return 'This file cannot be previewed.';
}
