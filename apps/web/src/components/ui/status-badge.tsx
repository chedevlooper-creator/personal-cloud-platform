import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15',
  warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  running: 'bg-emerald-500/10 text-emerald-500',
  stopped: 'bg-zinc-500/10 text-zinc-500',
  pending: 'bg-amber-500/10 text-amber-500',
} as const;

interface StatusBadgeProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant = 'default', children, className, dot = false }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          variant === 'running' && 'bg-emerald-500 animate-pulse',
          variant === 'stopped' && 'bg-zinc-500',
          variant === 'error' && 'bg-destructive',
          variant === 'pending' && 'bg-amber-500',
          variant === 'success' && 'bg-emerald-500',
          variant === 'warning' && 'bg-amber-500',
          variant === 'info' && 'bg-blue-500',
          variant === 'default' && 'bg-muted-foreground',
        )} />
      )}
      {children}
    </span>
  );
}
