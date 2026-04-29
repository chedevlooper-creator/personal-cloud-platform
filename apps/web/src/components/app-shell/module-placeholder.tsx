import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
        {actionLabel && (
          <Button type="button" className="mt-5" disabled>
            {actionLabel}
          </Button>
        )}
      </section>
    </div>
  );
}
