'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  History,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { agentApi, apiEndpoints, toastApiError} from '@/lib/api';
import { cn } from '@/lib/utils';
import { CreateAutomationDialog } from '@/components/automations/create-automation-dialog';
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
  scheduleType: 'manual' | 'hourly' | 'daily' | 'weekly' | 'cron';
  cronExpression?: string | null;
  prompt?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  notificationMode?: string | null;
};

type AutomationRun = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  trigger: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: string | null;
  error: string | null;
  output: string | null;
  createdAt: string;
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'history', label: 'History' },
];

function formatRelative(value: string | null | undefined) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  if (min < 1) return diff >= 0 ? 'in <1m' : 'just now';
  if (min < 60) return diff >= 0 ? `in ${min}m` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return diff >= 0 ? `in ${hr}h` : `${hr}h ago`;
  const day = Math.round(hr / 24);
  return diff >= 0 ? `in ${day}d` : `${day}d ago`;
}

function describeSchedule(a: Automation) {
  if (a.scheduleType === 'cron' && a.cronExpression) return `cron · ${a.cronExpression}`;
  return a.scheduleType;
}

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await agentApi.get('/automations');
      const payload = res.data as { automations: Automation[] } | Automation[];
      return Array.isArray(payload) ? payload : payload.automations;
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
    onError: (e) => toastApiError(e, 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted');
    },
    onError: (e) => toastApiError(e, 'Failed to delete'),
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.post(`/automations/${id}/run`);
    },
    onSuccess: () => {
      toast.success('Automation triggered');
    },
    onError: (e) => toastApiError(e, 'Failed to run'),
  });

  const copyWebhookUrl = useMutation({
    mutationFn: async (id: string) => {
      const res = await agentApi.get(`/automations/${id}/trigger-token`);
      const { token } = res.data as { token: string };
      const url = `${apiEndpoints.agent}/automations/${id}/trigger?token=${token}`;
      await navigator.clipboard.writeText(url);
      return url;
    },
    onSuccess: () => toast.success('Webhook URL copied'),
    onError: (e) => toastApiError(e, 'Failed to fetch token'),
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
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Automation
        </Button>
      </div>

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
                      <h3 className="truncate font-medium text-foreground">{auto.title}</h3>
                      <StatusBadge variant={auto.enabled ? 'success' : 'stopped'} dot>
                        {auto.enabled ? 'Active' : 'Paused'}
                      </StatusBadge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {describeSchedule(auto)}
                      {auto.prompt ? ` · ${auto.prompt.slice(0, 60)}…` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span title={auto.nextRunAt ?? undefined}>
                        Next: <span className="text-foreground/80">{formatRelative(auto.nextRunAt)}</span>
                      </span>
                      <span title={auto.lastRunAt ?? undefined}>
                        Last: <span className="text-foreground/80">{formatRelative(auto.lastRunAt)}</span>
                      </span>
                      {auto.notificationMode && auto.notificationMode !== 'none' && (
                        <span>Notify: {auto.notificationMode}</span>
                      )}
                    </div>
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
                    <DropdownMenuTrigger
                      render={(props) => (
                        <Button {...props} size="sm" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setHistoryId(auto.id)}>
                        <History className="mr-2 h-4 w-4" /> View history
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyWebhookUrl.mutate(auto.id)}>
                        <Webhook className="mr-2 h-4 w-4" /> Copy webhook URL
                      </DropdownMenuItem>
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
              onClick: () => setCreateOpen(true),
            }}
          />
        )}
      </div>

      <CreateAutomationDialog open={createOpen} onOpenChange={setCreateOpen} />

      <RunHistoryDialog
        automationId={historyId}
        onOpenChange={(open) => !open && setHistoryId(null)}
      />
    </div>
  );
}

function RunHistoryDialog({
  automationId,
  onOpenChange,
}: {
  automationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-runs', automationId],
    queryFn: async () => {
      if (!automationId) return { runs: [] as AutomationRun[] };
      const res = await agentApi.get(`/automations/${automationId}/runs`);
      return res.data as { runs: AutomationRun[] };
    },
    enabled: !!automationId,
    refetchInterval: automationId ? 5_000 : false,
  });

  return (
    <Dialog open={!!automationId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run history</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : data && data.runs.length > 0 ? (
            <div className="space-y-2">
              {data.runs.map((run) => {
                const variant: 'success' | 'error' | 'info' | 'stopped' =
                  run.status === 'completed'
                    ? 'success'
                    : run.status === 'failed'
                      ? 'error'
                      : run.status === 'running'
                        ? 'info'
                        : 'stopped';
                const duration = run.durationMs
                  ? `${(Number(run.durationMs) / 1000).toFixed(1)}s`
                  : '—';
                return (
                  <div
                    key={run.id}
                    className="rounded-lg border border-border bg-card p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={variant} dot>
                          {run.status}
                        </StatusBadge>
                        <span className="text-muted-foreground">{run.trigger}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                      <span>Duration: {duration}</span>
                    </div>
                    {run.error && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                        {run.error}
                      </pre>
                    )}
                    {run.output && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[11px] text-foreground/80">
                        {run.output}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
