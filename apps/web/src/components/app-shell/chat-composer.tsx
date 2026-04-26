'use client';

import { ArrowUp, Paperclip, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelSelector } from '@/components/app-shell/model-selector';
import { PersonaSelector } from '@/components/app-shell/persona-selector';
import { PlanBadge } from '@/components/app-shell/plan-badge';
import { ToolApproval, ToolApprovalCard } from '@/components/app-shell/tool-approval-card';

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onUpload,
  isThinking,
  toolApproval,
  onApproveTool,
  onRejectTool,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onUpload: () => void;
  isThinking: boolean;
  toolApproval: ToolApproval | null;
  onApproveTool: () => void;
  onRejectTool: () => void;
}) {
  const canSend = value.trim().length > 0 && !isThinking;

  return (
    <div className="w-[calc(100vw-3rem)] min-w-0 max-w-full sm:w-full sm:max-w-[1120px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
        className="min-h-[168px] w-full min-w-0 max-w-full rounded-xl border border-zinc-700/80 bg-zinc-900/88 p-3 shadow-2xl shadow-black/30 ring-1 ring-white/[0.03] backdrop-blur dark:bg-zinc-900/88"
      >
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What can I do for you?"
          className="h-24 w-full min-w-0 resize-none bg-transparent px-3 py-3 text-xl text-zinc-100 outline-none placeholder:text-zinc-500 sm:text-2xl"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canSend) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <PersonaSelector />
            <ModelSelector />
            <PlanBadge />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              title="Attach files (Cmd/Ctrl+U)"
              aria-label="Attach files"
              onClick={onUpload}
              disabled={isThinking}
              className="rounded-full border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              <Paperclip className="sr-only" />
            </Button>
            <Button
              type="submit"
              size="icon-lg"
              title="Send message"
              aria-label="Send message"
              disabled={!canSend}
              className="rounded-full bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      {toolApproval && (
        <ToolApprovalCard approval={toolApproval} onApprove={onApproveTool} onReject={onRejectTool} />
      )}
    </div>
  );
}
