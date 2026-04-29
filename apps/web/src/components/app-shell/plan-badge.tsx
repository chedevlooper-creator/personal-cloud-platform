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
        'inline-flex h-7 items-center gap-2 rounded-full border border-[#6A512C] bg-[#3E321F] px-2.5 text-xs font-extrabold text-[#F4F0E6] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {plan}
    </span>
  );
}
