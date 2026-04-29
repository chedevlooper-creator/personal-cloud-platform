'use client';

import { useState } from 'react';
import { Plus, TerminalSquare, AlertTriangle, Loader2 } from 'lucide-react';
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
      ? 'bg-emerald-500/20 text-emerald-300'
      : connectionState === 'connecting'
        ? 'bg-zinc-500/20 text-zinc-300'
        : connectionState === 'reconnecting'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-red-500/20 text-red-300';

  return (
    <div className={`flex-1 p-2 bg-[#1e1e1e] relative ${isActive ? 'block' : 'hidden'}`}>
      <div
        className={`absolute top-2 right-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeStyle}`}
        role="status"
        aria-live="polite"
      >
        {connectionState}
      </div>
      {connectionState !== 'connected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 z-10">
          <Loader2 className="animate-spin text-zinc-400 mr-2" />
          <span className="text-zinc-400">
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
        image: 'ubuntu:latest', // Default image
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

  return (
    <div className="flex h-full w-full flex-col relative">
      <div className="flex h-10 items-center bg-[#252526] border-b border-[#333333]">
        <div className="flex-1 flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center px-4 h-full border-r border-[#333333] text-xs transition-colors ${
                activeTabId === tab.id ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500' : 'text-zinc-400 hover:bg-[#2d2d2d]'
              }`}
            >
              <TerminalSquare className="mr-2 h-3 w-3" />
              {tab.name}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-white mr-2"
          onClick={() => createRuntimeMutation.mutate()}
          disabled={createRuntimeMutation.isPending}
          aria-label="New terminal session"
          title="New terminal session"
        >
          {createRuntimeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {tabs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e1e] text-zinc-500">
          <TerminalSquare className="h-12 w-12 mb-4 opacity-50" />
          <p>No active terminal sessions.</p>
          <Button 
            className="mt-4 bg-blue-600 hover:bg-blue-500"
            onClick={() => createRuntimeMutation.mutate()}
            disabled={createRuntimeMutation.isPending}
          >
            {createRuntimeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        <AlertDialogContent className="bg-[#2d2d2d] border-[#444] text-zinc-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-400">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Command Blocked
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              The command you attempted to run violates our security policy and has been blocked.
              <div className="mt-2 p-2 bg-black rounded font-mono text-sm text-red-300">
                {blockedCommand}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-blue-600 hover:bg-blue-500 text-white">I Understand</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
