'use client';

import type React from 'react';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/app-shell/app-shell';
import { useUser } from '@/lib/auth';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();

  return (
    <>
      <AppShell user={user ?? undefined}>{children}</AppShell>
      <Toaster richColors />
    </>
  );
}
