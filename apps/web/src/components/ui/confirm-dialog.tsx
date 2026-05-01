'use client';

import { useState } from 'react';
import type React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  variant = 'default',
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label="Pencereyi kapat"
        tabIndex={-1}
      />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          {(variant === 'destructive' || variant === 'warning') && (
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              variant === 'destructive' ? 'bg-destructive/10' : 'bg-amber-500/10'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                variant === 'destructive' ? 'text-destructive' : 'text-amber-500'
              }`} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            size="sm"
            className={variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'İşleniyor...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
