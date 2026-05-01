import type React from 'react';
import { Toaster } from 'sonner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors />
    </>
  );
}
