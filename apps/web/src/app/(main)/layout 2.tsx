'use client';

import { useUser, useLogout } from '@/lib/auth';
import type React from 'react';
import { Home, Settings, LogOut, TerminalSquare, FolderKanban, Rocket, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Toaster } from 'sonner';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useUser();
  const logoutMutation = useLogout();
  const pathname = usePathname();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Workspaces', href: '/workspaces', icon: FolderKanban },
    { name: 'Hosting', href: '/hosting', icon: Rocket },
    { name: 'Skills', href: '/skills', icon: Sparkles },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Sidebar Navigation */}
      <div className="flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex h-14 items-center border-b border-zinc-200 dark:border-zinc-800 px-4">
          <TerminalSquare className="mr-2 h-6 w-6 text-blue-600 dark:text-blue-500" />
          <span className="font-semibold tracking-tight">Cloud Workspace</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50'
                )}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
          <div className="mb-4 flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold dark:bg-blue-900 dark:text-blue-300">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="ml-3 truncate">
              <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Log out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <Toaster richColors />
    </div>
  );
}
