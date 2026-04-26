import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'text' | 'card' | 'avatar' | 'button';
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('h-4 animate-pulse rounded-md bg-muted', className)} />;
}

export function LoadingSkeleton({ className, lines = 3, variant = 'text' }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('space-y-3 rounded-xl border border-border bg-card p-4', className)}>
        <SkeletonLine className="h-5 w-2/3" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-4/5" />
        <SkeletonLine className="h-8 w-24" />
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="h-3 w-48" />
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return <SkeletonLine className={cn('h-8 w-20 rounded-lg', className)} />;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 ? 'w-3/5' : 'w-full'} />
      ))}
    </div>
  );
}
