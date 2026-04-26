'use client';

import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileText, X } from 'lucide-react';
import { workspaceApi } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { useWorkspaceStore } from '@/store/workspace';

type FileContentResponse = {
  path: string;
  name: string;
  mimeType: string | null;
  size: number;
  content: string;
  updatedAt: string;
};

export default function WorkspaceEditor() {
  const { currentWorkspaceId, selectedFile, selectedItem, openFiles, setSelectedFile, removeOpenFile } = useWorkspaceStore();

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

  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
    return 'plaintext';
  };

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {openFiles.length > 0 && (
        <div className="flex h-9 items-end overflow-x-auto bg-[#252526]">
          {openFiles.map((file) => (
            <div
              key={file}
              className={`group flex h-full min-w-[120px] max-w-[220px] cursor-pointer items-center justify-between border-r border-[#1e1e1e] px-3 text-sm transition-colors ${
                selectedFile === file ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:bg-[#1e1e1e]/80'
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <span className="truncate">{file.split('/').pop()}</span>
              <button
                type="button"
                className={`ml-2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-[#444444] ${
                  selectedFile === file ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeOpenFile(file);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex-1">
        {!selectedFile ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <div className="max-w-sm text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="mb-2 text-xl font-semibold text-zinc-300">Select a file</p>
              <p className="text-sm">Use the explorer to open text files and inspect metadata.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-500">Loading preview...</div>
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
            theme="vs-dark"
            path={selectedFile}
            defaultLanguage={getLanguage(selectedFile)}
            value={fileContent?.content ?? ''}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              readOnly: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
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
    <div className="flex h-full items-center justify-center p-8 text-zinc-500">
      <div className="max-w-md rounded-lg border border-[#333333] bg-[#252526] p-6">
        <AlertCircle className="mb-3 h-6 w-6 text-amber-400" />
        <h2 className="font-semibold text-zinc-200">{title}</h2>
        <p className="mt-2 text-sm">{detail}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-zinc-500">Type</dt>
            <dd className="mt-1 text-zinc-300">{mimeType || 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Size</dt>
            <dd className="mt-1 text-zinc-300">{size === undefined ? '-' : formatBytes(size)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function getPreviewError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.error || response?.data?.message || 'This file cannot be previewed.';
  }

  return 'This file cannot be previewed.';
}
