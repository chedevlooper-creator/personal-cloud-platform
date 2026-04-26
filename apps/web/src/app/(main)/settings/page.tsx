'use client';

import { useUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { data: user } = useUser();

  return (
    <div className="flex-1 overflow-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          Manage your account, billing, and OAuth integrations.
        </p>
      </header>

      <div className="max-w-2xl space-y-8">
        {/* Profile Settings */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Profile</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={user?.name || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={user?.email || ''} readOnly className="bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <Button>Save Changes</Button>
          </div>
        </section>

        {/* OAuth Integrations */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Integrations</h2>
          <p className="mb-4 text-sm text-zinc-500">Connect your external accounts to allow agents to interact with them.</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center dark:bg-zinc-800">G</div>
                <div>
                  <p className="font-medium">Google</p>
                  <p className="text-sm text-zinc-500">Not connected</p>
                </div>
              </div>
              <Button variant="outline">Connect</Button>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center dark:bg-zinc-800">GH</div>
                <div>
                  <p className="font-medium">GitHub</p>
                  <p className="text-sm text-zinc-500">Not connected</p>
                </div>
              </div>
              <Button variant="outline">Connect</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
