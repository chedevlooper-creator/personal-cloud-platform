'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Loader2, MoreHorizontal, Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { agentApi, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Tab = 'active' | 'paused' | 'history';

type Automation = {
  id: string;
  title: string;
  enabled: boolean;
  scheduleType: string;
  prompt?: string | null;
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'history', label: 'History' },
];

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await agentApi.get('/automations');
      return res.data as Automation[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await agentApi.patch(`/automations/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation updated');
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted');
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to delete')),
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.post(`/automations/${id}/run`);
    },
    onSuccess: () => {
      toast.success('Automation triggered');
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to run')),
  });

  const all = automations || [];
  const filtered =
    activeTab === 'active'
      ? all.filter((a) => a.enabled)
      : activeTab === 'paused'
        ? all.filter((a) => !a.enabled)
        : all;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Automations</h2>
          <p className="text-sm text-muted-foreground">Schedule AI tasks to run automatically</p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Automation
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((auto) => (
              <div
                key={auto.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{auto.title}</h3>
                      <StatusBadge variant={auto.enabled ? 'success' : 'stopped'} dot>
                        {auto.enabled ? 'Active' : 'Paused'}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {auto.scheduleType} · {auto.prompt?.slice(0, 60)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runMutation.mutate(auto.id)}
                    disabled={runMutation.isPending}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" /> Run
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button size="sm" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          toggleMutation.mutate({ id: auto.id, enabled: !auto.enabled })
                        }
                      >
                        {auto.enabled ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" /> Resume
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(auto.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock3 className="h-6 w-6" />}
            title={`No ${activeTab} automations`}
            description="Create an automation to schedule AI tasks like file processing, reports, or backups."
            action={{
              label: 'Create automation',
              onClick: () => {},
            }}
          />
        )}
      </div>
    </div>
  );
}
