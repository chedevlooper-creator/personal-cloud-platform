'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function FileTree({ workspaceId }: { workspaceId: string }) {
  const { setSelectedFile, addOpenFile, selectedFile } = useWorkspaceStore();

  const { data: files, isLoading } = useQuery({
    queryKey: ['workspace-files', workspaceId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/workspaces/${workspaceId}/files`, { withCredentials: true });
      return res.data;
    },
    // Optional: fallback data for testing
    initialData: [
      { name: 'src', type: 'directory', path: 'src' },
      { name: 'package.json', type: 'file', path: 'package.json' },
      { name: 'README.md', type: 'file', path: 'README.md' },
    ],
  });

  const handleFileClick = (file: any) => {
    if (file.type === 'file') {
      setSelectedFile(file.path);
      addOpenFile(file.path);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs text-zinc-500">Loading files...</div>;
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex h-8 items-center px-4 font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Explorer
      </div>
      <div className="flex-1 overflow-auto py-2">
        <ul className="space-y-1 px-2">
          {files?.map((file: any) => (
            <li 
              key={file.path} 
              className={`flex cursor-pointer items-center rounded-md px-2 py-1 transition-colors hover:bg-zinc-200 dark:hover:bg-[#2a2d2e] ${selectedFile === file.path ? 'bg-[#37373d] text-white' : 'text-[#cccccc]'}`}
              onClick={() => handleFileClick(file)}
            >
              {file.type === 'directory' ? (
                <>
                  <ChevronRight className="mr-1 h-4 w-4 text-zinc-400" />
                  <Folder className="mr-2 h-4 w-4 text-blue-400" />
                </>
              ) : (
                <File className="ml-5 mr-2 h-4 w-4 text-zinc-400" />
              )}
              <span className="truncate">{file.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
