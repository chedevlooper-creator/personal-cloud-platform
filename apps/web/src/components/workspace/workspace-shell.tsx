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
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b border-border bg-card px-4 text-sm shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="font-semibold text-foreground">Workspace: {workspaceId}</h1>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={22} minSize={14} maxSize={34} className="bg-card">
            <FileTree workspaceId={workspaceId} />
          </ResizablePanel>

          <ResizableHandle className="bg-border hover:bg-primary active:bg-primary" />

          <ResizablePanel defaultSize={58}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={70} minSize={30}>
                <div className="h-full bg-background">
                  <Editor />
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-border hover:bg-primary active:bg-primary" />

              <ResizablePanel defaultSize={30} minSize={10}>
                <div className="h-full bg-background">
                  <Terminal workspaceId={workspaceId} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="bg-border hover:bg-primary active:bg-primary" />

          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="bg-card">
            <Chat workspaceId={workspaceId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
