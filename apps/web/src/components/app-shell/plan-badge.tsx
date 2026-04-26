import { cn } from '@/lib/utils';

export function PlanBadge({ plan = process.env.NEXT_PUBLIC_PLAN_LABEL || 'Token Plan', className }: { plan?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 text-sm font-medium text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        'dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
        'border-amber-700/20 bg-amber-100 text-amber-900',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {plan}
    </span>
  );
}
