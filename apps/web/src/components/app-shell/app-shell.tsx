'use client';

import { useState } from 'react';
import type React from 'react';
import { AuthUser } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { KeyboardShortcutProvider } from '@/components/app-shell/keyboard-shortcut-provider';
import { MainCanvas } from '@/components/app-shell/main-canvas';
import { Sidebar } from '@/components/app-shell/sidebar';

export function AppShell({ children, user }: { children: React.ReactNode; user?: AuthUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <KeyboardShortcutProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <Sidebar
          user={user}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />
        <MainCanvas
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
          onOpenSidebar={() => setMobileOpen(true)}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </MainCanvas>
      </div>
    </KeyboardShortcutProvider>
  );
}
