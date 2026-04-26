'use client';

import { useWorkspaceStore } from '@/store/workspace';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

// Dynamically load components to avoid SSR issues with Monaco and Xterm
const FileTree = dynamic(() => import('@/components/workspace/file-tree'), { ssr: false });
const Editor = dynamic(() => import('@/components/workspace/editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/workspace/terminal'), { ssr: false });
const Chat = dynamic(() => import('@/components/workspace/chat'), { ssr: false });

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const { setCurrentWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    setCurrentWorkspaceId(params.id);
    return () => setCurrentWorkspaceId(null);
  }, [params.id, setCurrentWorkspaceId]);

  return (
    <div className="flex h-screen w-full flex-col bg-[#1e1e1e] text-[#cccccc]">
      {/* Workspace Header */}
      <div className="flex h-10 items-center justify-between border-b border-[#333333] bg-[#252526] px-4 text-sm shadow-sm">
        <div className="flex items-center space-x-4">
          <span className="font-semibold text-[#cccccc]">Workspace: {params.id}</span>
        </div>
      </div>

      {/* Main IDE Area */}
      <div className="flex-1 overflow-hidden">
        {/* @ts-ignore */}
        <ResizablePanelGroup direction="horizontal">
          {/* Left Sidebar: File Tree */}
          <ResizablePanel defaultSize={20} minSize={10} maxSize={30} className="bg-[#252526]">
            <FileTree workspaceId={params.id} />
          </ResizablePanel>
          
          <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />

          {/* Center: Editor + Terminal */}
          <ResizablePanel defaultSize={60}>
            {/* @ts-ignore */}
            <ResizablePanelGroup direction="vertical">
              {/* Editor Area */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <div className="h-full bg-[#1e1e1e]">
                  <Editor />
                </div>
              </ResizablePanel>
              
              <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />
              
              {/* Terminal Area */}
              <ResizablePanel defaultSize={30} minSize={10}>
                <div className="h-full bg-[#1e1e1e]">
                  <Terminal workspaceId={params.id} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />

          {/* Right Sidebar: Agent Chat */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="bg-[#252526]">
            <Chat workspaceId={params.id} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
