'use client';

import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ToolApproval = {
  toolName: string;
  description: string;
};

export function ToolApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: ToolApproval;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-info/20 bg-info/10 text-info">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{approval.toolName}</p>
          <p className="mt-1 text-muted-foreground">{approval.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" onClick={onApprove}>
          Approve
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onReject}>
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}
