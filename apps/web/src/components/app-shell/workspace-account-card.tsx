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
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#656779] bg-[#454653] text-xs font-bold text-[#F0F0F0]"
      >
        {name.charAt(0).toUpperCase()}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-lg border border-[#44454A] bg-[#18191A] px-2.5 text-left transition-colors hover:bg-[#202126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#606166]',
      )}
    >
      <span className="flex shrink-0 items-center justify-center rounded-md border border-[#656779] bg-[#454653] px-2 py-1 text-[11px] font-bold text-[#F0F0F0]">
        {name}
      </span>
      <span className="min-w-0 flex-1" />
      <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-90 text-[#A8A8A8]" />
    </button>
  );
}
