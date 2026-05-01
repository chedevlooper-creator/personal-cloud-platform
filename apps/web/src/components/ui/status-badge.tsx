import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-foreground dark:bg-warning/20 dark:text-warning',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info dark:bg-info/15',
  running: 'bg-success/10 text-success',
  stopped: 'bg-muted text-muted-foreground',
  pending: 'bg-warning/15 text-warning-foreground dark:bg-warning/20 dark:text-warning',
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
        'inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-border/40 backdrop-blur-sm',
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          variant === 'running' && 'bg-success motion-safe:animate-pulse',
          variant === 'stopped' && 'bg-muted-foreground',
          variant === 'error' && 'bg-destructive',
          variant === 'pending' && 'bg-warning',
          variant === 'success' && 'bg-success',
          variant === 'warning' && 'bg-warning',
          variant === 'info' && 'bg-info',
          variant === 'default' && 'bg-muted-foreground',
        )} />
      )}
      {children}
    </span>
  );
}
