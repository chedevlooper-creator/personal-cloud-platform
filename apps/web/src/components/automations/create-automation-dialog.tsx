'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { agentApi, getApiErrorMessage, workspaceApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type ScheduleType = 'manual' | 'hourly' | 'daily' | 'weekly' | 'cron';
type NotificationMode = 'none' | 'in-app' | 'email-mock' | 'webhook';

type WorkspaceSummary = { id: string; name: string };

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAutomationDialog({ open, onOpenChange }: CreateAutomationDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('manual');
  const [cronExpression, setCronExpression] = useState('');
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('in-app');
  const [webhookUrl, setWebhookUrl] = useState('');

  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as { workspaces: WorkspaceSummary[] };
    },
    enabled: open,
  });
  const workspaces = workspacesData?.workspaces ?? [];

  useEffect(() => {
    if (open && !workspaceId && workspaces.length > 0 && workspaces[0]) {
      // Default-select the first workspace when the dialog opens; the
      // selection is user-overridable so the cascading-render warning is
      // not applicable here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspaceId(workspaces[0].id);
    }
  }, [open, workspaces, workspaceId]);

  const reset = () => {
    setTitle('');
    setPrompt('');
    setScheduleType('manual');
    setCronExpression('');
    setNotificationMode('in-app');
    setWebhookUrl('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: title.trim(),
        prompt: prompt.trim(),
        scheduleType,
        notificationMode,
        enabled: true,
      };
      if (workspaceId) body.workspaceId = workspaceId;
      if (scheduleType === 'cron') body.cronExpression = cronExpression.trim();
      if (notificationMode === 'webhook') body.webhookUrl = webhookUrl.trim();

      const res = await agentApi.post('/automations', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created');
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to create automation')),
  });

  const valid =
    title.trim().length > 0 &&
    prompt.trim().length > 0 &&
    (scheduleType !== 'cron' || cronExpression.trim().length > 0) &&
    (notificationMode !== 'webhook' || /^https?:\/\//i.test(webhookUrl.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create automation</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="auto-title">Title</Label>
            <Input
              id="auto-title"
              placeholder="Daily standup summary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto-prompt">Prompt</Label>
            <Textarea
              id="auto-prompt"
              placeholder="Summarize today's commits and post to /workspace/standup.md"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto-workspace">Workspace</Label>
            <NativeSelect
              id="auto-workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              <option value="">Select workspace…</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-schedule">Schedule</Label>
              <NativeSelect
                id="auto-schedule"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
              >
                <option value="manual">Manual / webhook only</option>
                <option value="hourly">Hourly (top of hour)</option>
                <option value="daily">Daily at 09:00 UTC</option>
                <option value="weekly">Weekly Mon 09:00 UTC</option>
                <option value="cron">Custom cron</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-notify">Notify</Label>
              <NativeSelect
                id="auto-notify"
                value={notificationMode}
                onChange={(e) => setNotificationMode(e.target.value as NotificationMode)}
              >
                <option value="none">None</option>
                <option value="in-app">In-app only</option>
                <option value="email-mock">Email (mock)</option>
                <option value="webhook">Webhook POST</option>
              </NativeSelect>
            </div>
          </div>

          {scheduleType === 'cron' && (
            <div className="space-y-1.5">
              <Label htmlFor="auto-cron">Cron expression</Label>
              <Input
                id="auto-cron"
                placeholder="*/15 * * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Standard 5-field cron. Next-run estimate is hidden for custom cron schedules.
              </p>
            </div>
          )}

          {notificationMode === 'webhook' && (
            <div className="space-y-1.5">
              <Label htmlFor="auto-webhook">Webhook URL</Label>
              <Input
                id="auto-webhook"
                type="url"
                placeholder="https://example.com/hooks/automation"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Each run POSTs JSON with an <code className="font-mono">X-Pcp-Signature</code>{' '}
                header (HMAC SHA-256).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!valid || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
