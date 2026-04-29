'use client';

import { ArrowUp, FileText, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelSelector } from '@/components/app-shell/model-selector';
import { PersonaSelector } from '@/components/app-shell/persona-selector';
import { PlanBadge } from '@/components/app-shell/plan-badge';
import { ToolApproval, ToolApprovalCard } from '@/components/app-shell/tool-approval-card';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onUpload,
  isThinking,
  toolApproval,
  onApproveTool,
  onRejectTool,
  attachments = [],
  onRemoveAttachment,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onUpload: () => void;
  isThinking: boolean;
  toolApproval: ToolApproval | null;
  onApproveTool: () => void;
  onRejectTool: () => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
}) {
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isThinking;

  return (
    <div className="group/composer w-full min-w-0 max-w-full sm:max-w-[700px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
        className="relative min-h-[116px] w-full min-w-0 max-w-full rounded-2xl border border-border bg-card/95 px-4 pb-2 pt-[19px] shadow-[0_20px_42px_-12px_rgba(0,0,0,0.5)] ring-1 ring-border/40 backdrop-blur transition-all duration-300 focus-within:border-primary/40 focus-within:ring-primary/20 focus-within:shadow-[0_24px_48px_-12px_hsl(var(--primary)/0.18)]"
      >
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-border/60" />
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((file, idx) => (
              <span
                key={`${file.name}-${idx}`}
                className="group/chip inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-border/70 bg-muted/60 py-1 pl-2 pr-1 text-xs text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
                title={`${file.name} (${formatBytes(file.size)})`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                {onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(idx)}
                    aria-label={`Remove ${file.name}`}
                    className="ml-0.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What can I do for you?"
          className="h-[42px] w-full min-w-0 resize-none bg-transparent p-0 text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
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
              className="h-7 w-9 rounded-lg border-border/70 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <Paperclip className="sr-only" />
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              title="Send message"
              aria-label="Send message"
              disabled={!canSend}
              className="h-7 w-7 rounded-[9px] bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.5)] transition-all hover:bg-primary/90 hover:shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.7)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-border/40" />
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
