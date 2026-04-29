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
    <div className="w-[calc(100vw-3rem)] min-w-0 max-w-full sm:w-full sm:max-w-[700px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
        className="relative min-h-[116px] w-full min-w-0 max-w-full rounded-xl border border-[#404148] bg-[#16171A]/95 px-4 pb-1 pt-[19px] shadow-[0_20px_42px_rgba(0,0,0,0.53)] ring-1 ring-white/[0.03] backdrop-blur dark:bg-[#16171A]/95"
      >
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[#555761]/65" />
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What can I do for you?"
          className="h-[42px] w-full min-w-0 resize-none bg-transparent p-0 text-lg font-medium text-[#F0F0F0] outline-none placeholder:text-[#747B87]"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canSend) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <PersonaSelector compact />
            <ModelSelector compact />
            <PlanBadge />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Attach files (Cmd/Ctrl+U)"
              aria-label="Attach files"
              onClick={onUpload}
              disabled={isThinking}
              className="h-7 w-10 rounded-xl border-[#4B4C52] bg-[#202124] text-[#A7A9AD] hover:bg-[#27282E] hover:text-[#F0F0F0]"
            >
              <Plus className="h-5 w-5" />
              <Paperclip className="sr-only" />
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              title="Send message"
              aria-label="Send message"
              disabled={!canSend}
              className="h-7 w-7 rounded-[9px] border border-[#3E465E] bg-[#25283A] text-[#9EA8CA] hover:bg-[#303650] hover:text-[#F0F0F0] disabled:bg-[#25283A] disabled:text-[#5D6375]"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[#0D0E10]/90" />
      </form>

      {toolApproval && (
        <ToolApprovalCard
          approval={toolApproval}
          onApprove={onApproveTool}
          onReject={onRejectTool}
        />
      )}
    </div>
  );
}
