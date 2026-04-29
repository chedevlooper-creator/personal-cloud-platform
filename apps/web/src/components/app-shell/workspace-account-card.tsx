import { ChevronDown } from 'lucide-react';
import { AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function WorkspaceAccountCard({
  user,
  collapsed,
}: {
  user?: AuthUser;
  collapsed?: boolean;
}) {
  const name = user?.name || user?.email?.split('@')[0] || 'workspace';

  if (collapsed) {
    return (
      <button
        type="button"
        title="Account"
        aria-label="Account"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground hover:bg-sidebar-accent/80"
      >
        {name.charAt(0).toUpperCase()}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-sidebar-foreground">
        {name}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
