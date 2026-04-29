import { cn } from '@/lib/utils';

export function PlanBadge({
  plan = process.env.NEXT_PUBLIC_PLAN_LABEL || 'Free',
  className,
}: {
  plan?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse" />
      {plan}
    </span>
  );
}
