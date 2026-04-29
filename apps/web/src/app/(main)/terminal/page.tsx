'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, TerminalSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

const BLOCKED_PATTERNS = [
  /^rm\s+-rf\s+\//,
  /^sudo\b/,
  /^shutdown\b/,
  /^reboot\b/,
  /^halt\b/,
  /^mkfs\b/,
  /^dd\s+if=/,
  /:\(\)\{\s*:\|:&\s*\};:/,
  /^chmod\s+-R\s+777\s+\//,
  /^chown\s+-R\b/,
];

type TerminalLine = {
  id: number;
  type: 'input' | 'output' | 'error' | 'blocked';
  text: string;
  timestamp: Date;
};

type TerminalSession = {
  id: string;
  name: string;
  lines: TerminalLine[];
};

let lineIdCounter = 0;

export default function TerminalPage() {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: 'default', name: 'Terminal 1', lines: [] },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [activeSession?.lines.length]);

  const addLine = useCallback((sessionId: string, type: TerminalLine['type'], text: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, lines: [...s.lines, { id: ++lineIdCounter, type, text, timestamp: new Date() }] }
          : s
      )
    );
  }, []);

  const isBlocked = (cmd: string) => BLOCKED_PATTERNS.some((p) => p.test(cmd.trim()));

  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!activeSession) return;
      addLine(activeSession.id, 'input', `$ ${cmd}`);
      setHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);

      if (isBlocked(cmd)) {
        addLine(activeSession.id, 'blocked', `⛔ Command blocked: "${cmd}" is not allowed for security reasons.`);
        return;
      }

      // Simulate command execution (real implementation would hit runtime service)
      try {
        addLine(activeSession.id, 'output', `[mock] Command "${cmd}" would execute in workspace sandbox`);
      } catch {
        addLine(activeSession.id, 'error', `Error executing command`);
      }
    },
    [activeSession, addLine]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    executeCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex] || '');
        }
      }
    }
  };

  const addSession = () => {
    const id = `term-${Date.now()}`;
    const name = `Terminal ${sessions.length + 1}`;
    setSessions((prev) => [...prev, { id, name, lines: [] }]);
    setActiveSessionId(id);
  };

  const removeSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fallback = { id: 'default', name: 'Terminal 1', lines: [] as TerminalLine[] };
        return [fallback];
      }
      return next;
    });
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find((s) => s.id !== id)?.id || 'default');
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Session Tabs */}
      <div className="flex h-10 items-center gap-0.5 border-b border-border bg-card px-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSessionId(s.id)}
            className={cn(
              'group flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
              activeSessionId === s.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <TerminalSquare className="h-3 w-3" />
            <span>{s.name}</span>
            {sessions.length > 1 && (
              <button
                type="button"
                title="Close session"
                aria-label={`Close ${s.name}`}
                className="ml-1 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id); }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </button>
        ))}
        <Button size="icon-xs" variant="ghost" onClick={addSession} title="New terminal" aria-label="New terminal">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {activeSession && activeSession.lines.length === 0 && (
          <div className="text-zinc-500">
            CloudMind OS Terminal — workspace sandbox
            <br />
            Type a command to get started.
          </div>
        )}
        {activeSession?.lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'whitespace-pre-wrap py-0.5',
              line.type === 'input' && 'text-emerald-400',
              line.type === 'output' && 'text-zinc-300',
              line.type === 'error' && 'text-red-400',
              line.type === 'blocked' && 'text-amber-400'
            )}
          >
            {line.text}
          </div>
        ))}

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-1 flex items-center gap-1">
          <span className="text-emerald-400">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-none bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Type a command..."
            autoFocus
            spellCheck={false}
            aria-label="Terminal input"
          />
        </form>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Close terminal session"
        description="This will end the session and clear its history."
        confirmLabel="Close"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) removeSession(deleteTarget);
        }}
      />
    </div>
  );
}
