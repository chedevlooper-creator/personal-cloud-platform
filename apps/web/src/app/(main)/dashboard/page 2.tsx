'use client';

import { useUser } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { PlusCircle, Server, FileCode, Play } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DashboardPage() {
  const { data: user } = useUser();

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/workspaces`, { withCredentials: true });
      return res.data;
    },
  });

  return (
    <div className="flex-1 overflow-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Good morning, {user?.name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          Here is an overview of your personal cloud environment.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
            <PlusCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New Workspace</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create a fresh isolated environment</p>
        </div>

        {/* Existing Workspaces List */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Recent Workspaces</h2>
            <Link href="/workspaces" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              View all
            </Link>
          </div>
          
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-zinc-500">Loading...</div>
          ) : (workspaces?.length ?? 0) > 0 ? (
            <ul className="space-y-3">
              {workspaces?.slice(0, 3).map((ws: any) => (
                <li key={ws.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                  <div className="flex items-center">
                    <Server className="mr-4 h-8 w-8 text-zinc-400" />
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{ws.name || 'Untitled Workspace'}</p>
                      <p className="text-xs text-zinc-500">Updated {new Date(ws.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Link 
                    href={`/workspace/${ws.id}`}
                    className="flex items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Open <Play className="ml-2 h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-zinc-500 border border-dashed rounded-lg border-zinc-300 dark:border-zinc-700">
              <FileCode className="mb-2 h-8 w-8 text-zinc-400" />
              <p>No workspaces found. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
