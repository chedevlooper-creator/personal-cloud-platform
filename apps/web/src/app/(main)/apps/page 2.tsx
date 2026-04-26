'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ExternalLink, RefreshCw, Trash2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AppsPage() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ['published-apps'],
    queryFn: async () => {
      // Mocked endpoint - assuming Phase 6 Publish service is running here
      // const res = await axios.get(`${API_URL}/publish/apps`, { withCredentials: true });
      // return res.data;
      
      return [
        { id: '1', name: 'My Portfolio', subdomain: 'portfolio', status: 'active', updatedAt: new Date().toISOString() },
        { id: '2', name: 'Test API', subdomain: 'api-test', status: 'building', updatedAt: new Date().toISOString() },
      ];
    },
  });

  return (
    <div className="flex-1 overflow-auto p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Published Apps</h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            Manage your deployed applications and their subdomains.
          </p>
        </div>
        <Button>Publish New App</Button>
      </header>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-zinc-500">Loading your apps...</div>
      ) : (apps?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {apps?.map((app: any) => (
            <div key={app.id} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center dark:bg-blue-900">
                      <Box className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{app.name}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{app.subdomain}.apps.platform.com</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6 flex items-center space-x-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    app.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    app.status === 'building' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                  <span className="text-xs text-zinc-500">Updated {new Date(app.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Redeploy">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <a 
                  href={`http://${app.subdomain}.apps.platform.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  <span>Open App</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="mb-4 text-zinc-500">You haven&apos;t published any apps yet.</p>
          <Button variant="outline">Learn How to Publish</Button>
        </div>
      )}
    </div>
  );
}
