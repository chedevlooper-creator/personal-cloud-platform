import { cn } from '@/lib/utils';

export function DottedBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage:
          'linear-gradient(rgba(42, 43, 46, 0.72) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 38, 42, 0.42) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        maskImage: 'linear-gradient(to bottom, transparent, black 7%, black 94%, transparent)',
      }}
    />
  );
}
