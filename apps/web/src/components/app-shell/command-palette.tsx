'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Clock3,
  FileSearch,
  Globe2,
  Home,
  MessageSquarePlus,
  Search,
  Settings,
  SquareTerminal,
  Upload,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

type CommandAction = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<CommandAction[]>(
    () => [
      {
        id: 'new-chat',
        label: 'New chat',
        hint: 'Start a conversation',
        icon: MessageSquarePlus,
        shortcut: '⌘N',
        run: () => {
          router.push('/chats');
          window.dispatchEvent(new Event('app:new-chat'));
        },
      },
      {
        id: 'search-files',
        label: 'Search files',
        hint: 'Find files in workspace',
        icon: FileSearch,
        run: () => router.push('/files'),
      },
      {
        id: 'upload',
        label: 'Upload files',
        hint: 'Upload to workspace',
        icon: Upload,
        shortcut: '⌘U',
        run: () => window.dispatchEvent(new Event('app:open-file-upload')),
      },
      {
        id: 'home',
        label: 'Home',
        hint: 'Dashboard overview',
        icon: Home,
        run: () => router.push('/dashboard'),
      },
      {
        id: 'automations',
        label: 'Automations',
        hint: 'Manage automations',
        icon: Clock3,
        run: () => router.push('/automations'),
      },
      {
        id: 'hosting',
        label: 'Hosting',
        hint: 'Manage hosted services',
        icon: Globe2,
        run: () => router.push('/hosting'),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        hint: 'Open web terminal',
        icon: SquareTerminal,
        run: () => router.push('/terminal'),
      },
      {
        id: 'snapshots',
        label: 'Snapshots',
        hint: 'Backup and restore',
        icon: Camera,
        run: () => router.push('/snapshots'),
      },
      {
        id: 'settings',
        label: 'Settings',
        hint: 'Account preferences',
        icon: Settings,
        run: () => router.push('/settings'),
      },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const runAction = useCallback(
    (action: CommandAction) => {
      action.run();
      onOpenChange(false);
      setQuery('');
      setSelectedIndex(0);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const action = filtered[selectedIndex];
        if (action) runAction(action);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange, open, filtered, selectedIndex, runAction]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            autoFocus
            className="h-8 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
            aria-label="Command search"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[320px] overflow-auto p-1.5" role="listbox">
          {filtered.length > 0 ? (
            filtered.map((action, i) => (
              <button
                key={action.id}
                type="button"
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => runAction(action)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${i === selectedIndex ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{action.label}</span>
                  <span className="block truncate text-xs opacity-60">{action.hint}</span>
                </span>
                {action.shortcut && (
                  <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {action.shortcut}
                  </kbd>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching commands.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
