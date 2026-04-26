'use client';

import Editor from '@monaco-editor/react';
import { useWorkspaceStore } from '@/store/workspace';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function WorkspaceEditor() {
  const { currentWorkspaceId, selectedFile, openFiles, setSelectedFile, removeOpenFile } = useWorkspaceStore();

  const { data: fileContent, isLoading } = useQuery({
    queryKey: ['file-content', currentWorkspaceId, selectedFile],
    queryFn: async () => {
      if (!selectedFile) return '';
      const res = await axios.get(`${API_URL}/workspaces/${currentWorkspaceId}/files/${encodeURIComponent(selectedFile)}`, {
        withCredentials: true,
      });
      return res.data.content;
    },
    enabled: !!selectedFile && !!currentWorkspaceId,
    initialData: selectedFile ? `// File: ${selectedFile}\n\nfunction helloWorld() {\n  console.log("Hello from Personal Cloud Platform");\n}` : '',
  });

  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Editor Tabs */}
      {openFiles.length > 0 && (
        <div className="flex h-9 items-end bg-[#252526] overflow-x-auto no-scrollbar">
          {openFiles.map((file) => (
            <div
              key={file}
              className={`group flex h-full min-w-[120px] max-w-[200px] cursor-pointer items-center justify-between border-r border-[#1e1e1e] px-3 text-sm transition-colors ${
                selectedFile === file ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] text-zinc-400 hover:bg-[#1e1e1e]/80'
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <span className="truncate">{file.split('/').pop()}</span>
              <div 
                className={`ml-2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-[#444444] ${selectedFile === file ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeOpenFile(file);
                }}
              >
                <X className="h-3 w-3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 relative">
        {!selectedFile ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="mb-2 text-xl font-semibold">Welcome to the Workspace</p>
              <p className="text-sm">Select a file from the explorer to start editing.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-500">Loading editor...</div>
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            path={selectedFile}
            defaultLanguage={getLanguage(selectedFile)}
            value={fileContent}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
