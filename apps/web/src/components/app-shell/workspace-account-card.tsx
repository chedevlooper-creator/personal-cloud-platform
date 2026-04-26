import { ChevronDown } from 'lucide-react';
import { AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function WorkspaceAccountCard({ user, collapsed }: { user?: AuthUser; collapsed?: boolean }) {
  const name = user?.name || user?.email?.split('@')[0] || 'workspace';

  if (collapsed) {
    return (
      <button
        type="button"
        title="Account"
        aria-label="Account"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {name.charAt(0).toUpperCase()}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">Personal workspace</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
