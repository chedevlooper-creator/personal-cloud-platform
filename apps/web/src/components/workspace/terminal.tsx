'use client';

import { useState } from 'react';
import { Plus, TerminalSquare, AlertTriangle, Loader2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { runtimeApi, toastApiError} from '@/lib/api';
import { useTerminal } from '@/hooks/use-terminal';

function TerminalTab({ runtimeId, isActive, onBlocked }: { runtimeId: string; isActive: boolean; onBlocked: (cmd: string) => void }) {
  const { terminalRef, connectionState } = useTerminal({ runtimeId, onCommandBlocked: onBlocked });

  const badgeStyle =
    connectionState === 'connected'
      ? 'bg-success/15 text-success'
      : connectionState === 'connecting'
        ? 'bg-muted text-muted-foreground'
        : connectionState === 'reconnecting'
          ? 'bg-warning/15 text-warning-foreground dark:text-warning'
          : 'bg-destructive/15 text-destructive';

  return (
    <div className={`flex-1 p-2 bg-background relative ${isActive ? 'block' : 'hidden'}`}>
      <div
        className={`absolute top-2 right-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeStyle}`}
        role="status"
        aria-live="polite"
      >
        {connectionState}
      </div>
      {connectionState !== 'connected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="motion-safe:animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">
            {connectionState === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </span>
        </div>
      )}
      <div className="h-full w-full" ref={terminalRef} />
    </div>
  );
}

export default function WorkspaceTerminal({ workspaceId }: { workspaceId: string }) {
  const [tabs, setTabs] = useState<{ id: string; name: string }[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [blockedCommand, setBlockedCommand] = useState<string | null>(null);

  const createRuntimeMutation = useMutation({
    mutationFn: async () => {
      const res = await runtimeApi.post('/runtimes', {
        workspaceId,
        image: 'node:20-alpine', // Must match runtime allowlist
        options: {},
      });
      const runtime = res.data;
      // Start it automatically
      await runtimeApi.post(`/runtimes/${runtime.id}/start`);
      return runtime.id;
    },
    onSuccess: (runtimeId) => {
      const newTab = { id: runtimeId, name: `bash-${tabs.length + 1}` };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(runtimeId);
    },
    onError: (error) => {
      toastApiError(error, 'Failed to start terminal');
    },
  });

  const handleBlocked = (cmd: string) => {
    setBlockedCommand(cmd);
  };

  const closeTab = (idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== idToClose);
      if (activeTabId === idToClose) {
        setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
      }
      return filtered;
    });
    // Optional: Stop the runtime backend when closing the tab
    // runtimeApi.post(`/runtimes/${idToClose}/stop`).catch(console.error);
  };

  return (
    <div className="flex h-full w-full flex-col relative">
      <div className="flex h-10 items-center bg-card border-b border-border">
        <div className="flex-1 flex overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex cursor-pointer items-center justify-between border-r border-border px-3 text-xs transition-colors h-full ${
                activeTabId === tab.id
                  ? 'bg-background text-primary border-t-2 border-t-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="flex items-center">
                <TerminalSquare className={`mr-2 h-3.5 w-3.5 ${activeTabId === tab.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span>{tab.name}</span>
              </div>
              <button
                type="button"
                aria-label={`Close ${tab.name}`}
                className={`ml-2 flex h-5 w-5 items-center justify-center rounded-sm hover:bg-destructive/10 hover:text-destructive ${
                  activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => closeTab(tab.id, e)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground mr-2"
          onClick={() => createRuntimeMutation.mutate()}
          disabled={createRuntimeMutation.isPending}
          aria-label="New terminal session"
          title="New terminal session"
        >
          {createRuntimeMutation.isPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {tabs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4 shadow-sm">
            <TerminalSquare className="h-8 w-8 text-muted-foreground/70" />
          </div>
          <p className="text-sm font-medium">No active terminal sessions</p>
          <p className="text-xs mt-1 text-muted-foreground/60 text-center max-w-[250px]">
            Start a new session to run commands and manage your workspace environment.
          </p>
          <Button
            className="mt-6 shadow-sm transition-all active:scale-[0.98]"
            onClick={() => createRuntimeMutation.mutate()}
            disabled={createRuntimeMutation.isPending}
          >
            {createRuntimeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Start Terminal Session
          </Button>
        </div>
      ) : (
        tabs.map((tab) => (
          <TerminalTab
            key={tab.id}
            runtimeId={tab.id}
            isActive={activeTabId === tab.id}
            onBlocked={handleBlocked}
          />
        ))
      )}

      <AlertDialog open={!!blockedCommand} onOpenChange={() => setBlockedCommand(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Command Blocked
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              The command you attempted to run violates our security policy and has been blocked.
              <div className="mt-2 p-2 rounded bg-muted font-mono text-sm text-destructive">
                {blockedCommand}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>I Understand</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
