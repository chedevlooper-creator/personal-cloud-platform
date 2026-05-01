'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { Bot, FileText, FolderTree, SquareTerminal } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useWorkspaceStore } from '@/store/workspace';
import { useChatPanel } from '@/components/chat/chat-panel-context';
import { cn } from '@/lib/utils';
import { workspaceApi, toastApiError } from '@/lib/api';
import { toast } from 'sonner';

const FileTree = dynamic(() => import('@/components/workspace/file-tree'), { ssr: false });
const Editor = dynamic(() => import('@/components/workspace/editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/workspace/terminal'), { ssr: false });

type MobilePanel = 'files' | 'editor' | 'terminal' | 'agent';

const mobilePanels: Array<{
  id: MobilePanel;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'files', label: 'Explorer', icon: FolderTree },
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'agent', label: 'Agent', icon: Bot },
];

export function WorkspaceShell({ workspaceId }: { workspaceId: string }) {
  const { setCurrentWorkspaceId, setSelectedFile, setSelectedItem, setOpenFiles, addOpenFile } = useWorkspaceStore();
  const { setActiveWorkspaceId, togglePanel } = useChatPanel();
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>('editor');

  useEffect(() => {
    setCurrentWorkspaceId(workspaceId);
    setSelectedFile(null);
    setSelectedItem(null);
    setOpenFiles([]);
    setActiveWorkspaceId(workspaceId);

    return () => {
      setCurrentWorkspaceId(null);
      setActiveWorkspaceId(null);
    };
  }, [setCurrentWorkspaceId, setOpenFiles, setSelectedFile, setSelectedItem, workspaceId, setActiveWorkspaceId]);

  // Listen for code apply events from chat markdown
  useEffect(() => {
    const handleApplyCode = (e: Event) => {
      const detail = (e as CustomEvent).detail as { code: string; filename: string };
      if (!detail) return;

      // Create file via workspace API
      const blob = new Blob([detail.code], { type: 'text/plain' });
      const file = new File([blob], detail.filename, { type: 'text/plain' });
      const form = new FormData();
      form.append('file', file);
      form.append('path', `/${detail.filename}`);

      workspaceApi
        .post(`/workspaces/${workspaceId}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(() => {
          toast.success(`"${detail.filename}" çalışma alanına kaydedildi`);
          // Open the file in editor
          const filePath = `/${detail.filename}`;
          setSelectedFile(filePath);
          addOpenFile(filePath);
          setSelectedItem({
            id: filePath,
            path: filePath,
            name: detail.filename,
            mimeType: 'text/plain',
            isDirectory: false,
            parentPath: '/',
            size: detail.code.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        })
        .catch((err) => {
          toastApiError(err, 'Dosya kaydedilemedi');
        });
    };

    window.addEventListener('app:apply-code-to-workspace', handleApplyCode);
    return () => window.removeEventListener('app:apply-code-to-workspace', handleApplyCode);
  }, [workspaceId, setSelectedFile, addOpenFile, setSelectedItem]);

  const handleMobilePanelChange = (panelId: MobilePanel) => {
    if (panelId === 'agent') {
      togglePanel();
      return;
    }
    setActiveMobilePanel(panelId);
  };

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b border-border bg-card px-4 text-sm shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="truncate font-semibold text-foreground">Çalışma alanı: {workspaceId}</h1>
        </div>
      </header>

      <div className="hidden flex-1 overflow-hidden md:block">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={22} minSize={14} maxSize={34} className="bg-card">
            <FileTree workspaceId={workspaceId} />
          </ResizablePanel>

          <ResizableHandle className="bg-border hover:bg-primary active:bg-primary" />

          <ResizablePanel defaultSize={78}>
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
        </ResizablePanelGroup>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="grid grid-cols-4 gap-1 border-b border-border bg-card p-1">
          {mobilePanels.map((panel) => {
            const Icon = panel.icon;
            const active = activeMobilePanel === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                className={cn(
                  'flex h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-pressed={active}
                onClick={() => handleMobilePanelChange(panel.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{panel.label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeMobilePanel === 'files' && <FileTree workspaceId={workspaceId} />}
          {activeMobilePanel === 'editor' && (
            <div className="h-full bg-background">
              <Editor />
            </div>
          )}
          {activeMobilePanel === 'terminal' && (
            <div className="h-full bg-background">
              <Terminal workspaceId={workspaceId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
