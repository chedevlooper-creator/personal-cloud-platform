import { AtSign, Globe2, Grid3X3 } from 'lucide-react';
import { AuthUser } from '@/lib/auth';

export function WorkspaceIdentityBar({ user }: { user?: AuthUser }) {
  const username = user?.name?.split(' ')[0]?.toLowerCase() || user?.email?.split('@')[0] || 'workspace';

  const items = [
    { icon: Globe2, label: `${username}.cloud.local` },
    { icon: Grid3X3, label: `${username}.space` },
    { icon: AtSign, label: `${username}@cloud.local` },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-center">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-500 md:gap-5 md:text-sm">
        {items.map((item) => (
          <span key={item.label} className="flex min-w-0 items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="max-w-[9rem] truncate md:max-w-none">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
