'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useWorkspaceStore } from '@/store/workspace';

const FileTree = dynamic(() => import('@/components/workspace/file-tree'), { ssr: false });
const Editor = dynamic(() => import('@/components/workspace/editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/workspace/terminal'), { ssr: false });
const Chat = dynamic(() => import('@/components/workspace/chat'), { ssr: false });

export function WorkspaceShell({ workspaceId }: { workspaceId: string }) {
  const { setCurrentWorkspaceId, setSelectedFile, setSelectedItem, setOpenFiles } = useWorkspaceStore();

  useEffect(() => {
    setCurrentWorkspaceId(workspaceId);
    setSelectedFile(null);
    setSelectedItem(null);
    setOpenFiles([]);

    return () => {
      setCurrentWorkspaceId(null);
    };
  }, [setCurrentWorkspaceId, setOpenFiles, setSelectedFile, setSelectedItem, workspaceId]);

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] text-[#cccccc]">
      <div className="flex h-10 items-center justify-between border-b border-[#333333] bg-[#252526] px-4 text-sm shadow-sm">
        <div className="flex items-center space-x-4">
          <span className="font-semibold text-[#cccccc]">Workspace: {workspaceId}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={22} minSize={14} maxSize={34} className="bg-[#252526]">
            <FileTree workspaceId={workspaceId} />
          </ResizablePanel>

          <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />

          <ResizablePanel defaultSize={58}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={70} minSize={30}>
                <div className="h-full bg-[#1e1e1e]">
                  <Editor />
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />

              <ResizablePanel defaultSize={30} minSize={10}>
                <div className="h-full bg-[#1e1e1e]">
                  <Terminal workspaceId={workspaceId} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="bg-[#333333] hover:bg-[#007acc] active:bg-[#007acc]" />

          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="bg-[#252526]">
            <Chat workspaceId={workspaceId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
