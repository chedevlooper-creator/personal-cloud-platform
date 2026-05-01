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
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { agentApi, apiEndpoints, toastApiError } from '@/lib/api';
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
  { id: 'active', label: 'Aktif' },
  { id: 'paused', label: 'Duraklatıldı' },
  { id: 'history', label: 'Geçmiş' },
];

const scheduleLabels: Record<Automation['scheduleType'], string> = {
  manual: 'Elle tetiklenir',
  hourly: 'Saatlik',
  daily: 'Her gün 09:00 UTC',
  weekly: 'Her hafta pazartesi 09:00 UTC',
  cron: 'Özel zamanlama',
};

const notificationLabels: Record<string, string> = {
  'in-app': 'Uygulama içi',
  'email-mock': 'E-posta',
  webhook: 'Webhook',
};

const runStatusLabels: Record<AutomationRun['status'], string> = {
  queued: 'Sırada',
  running: 'Çalışıyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
};

function formatRelative(value: string | null | undefined) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  if (min < 1) return diff >= 0 ? '<1 dk içinde' : 'az önce';
  if (min < 60) return diff >= 0 ? `${min} dk içinde` : `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return diff >= 0 ? `${hr} sa içinde` : `${hr} sa önce`;
  const day = Math.round(hr / 24);
  return diff >= 0 ? `${day} gün içinde` : `${day} gün önce`;
}

function describeSchedule(a: Automation) {
  return scheduleLabels[a.scheduleType] ?? a.scheduleType;
}

function describeNotification(mode: string | null | undefined) {
  if (!mode || mode === 'none') return null;
  return notificationLabels[mode] ?? mode;
}

function formatRunDuration(value: string | null) {
  if (!value) return '—';
  return `${(Number(value) / 1000).toFixed(1)} sn`;
}

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: automations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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
      toast.success('Otomasyon güncellendi');
    },
    onError: (e) => toastApiError(e, 'Otomasyon güncellenemedi'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Otomasyon silindi');
    },
    onError: (e) => toastApiError(e, 'Otomasyon silinemedi'),
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.post(`/automations/${id}/run`);
    },
    onSuccess: () => {
      toast.success('Otomasyon çalıştırıldı');
    },
    onError: (e) => toastApiError(e, 'Otomasyon çalıştırılamadı'),
  });

  const copyWebhookUrl = useMutation({
    mutationFn: async (id: string) => {
      const res = await agentApi.get(`/automations/${id}/trigger-token`);
      const { token } = res.data as { token: string };
      const url = `${apiEndpoints.agent}/automations/${id}/trigger?token=${token}`;
      await navigator.clipboard.writeText(url);
      return url;
    },
    onSuccess: () => toast.success('Webhook URL kopyalandı'),
    onError: (e) => toastApiError(e, 'Tetikleme tokenı alınamadı'),
  });

  const all = automations || [];
  const filtered =
    activeTab === 'active'
      ? all.filter((a) => a.enabled)
      : activeTab === 'paused'
        ? all.filter((a) => !a.enabled)
        : all;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Otomasyonlar</h2>
          <p className="text-sm text-muted-foreground">
            AI görevlerini otomatik çalışacak şekilde planlayın
          </p>
        </div>
        <Button size="touch" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Otomasyon oluştur
        </Button>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={cn(
              'min-h-11 flex-1 rounded-md px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            <LoadingSkeleton variant="card" />
            <LoadingSkeleton variant="card" />
          </div>
        ) : isError ? (
          <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>Agent servisine ulaşılamıyor. Otomasyonlar şu anda yüklenemiyor.</span>
            <Button
              size="touch"
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              onClick={() => void refetch()}
            >
              Yeniden dene
            </Button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((auto) => (
              <div
                key={auto.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 hover:ring-1 hover:ring-ring/30 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate font-medium text-foreground">{auto.title}</h3>
                      <StatusBadge variant={auto.enabled ? 'success' : 'stopped'} dot>
                        {auto.enabled ? 'Aktif' : 'Duraklatıldı'}
                      </StatusBadge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {describeSchedule(auto)}
                      {auto.prompt ? ` · ${auto.prompt.slice(0, 60)}…` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span title={auto.nextRunAt ?? undefined}>
                        Sıradaki:{' '}
                        <span className="text-foreground/80">{formatRelative(auto.nextRunAt)}</span>
                      </span>
                      <span title={auto.lastRunAt ?? undefined}>
                        Son:{' '}
                        <span className="text-foreground/80">{formatRelative(auto.lastRunAt)}</span>
                      </span>
                      {describeNotification(auto.notificationMode) && (
                        <span>Bildirim: {describeNotification(auto.notificationMode)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
                  <Button
                    size="touch"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => runMutation.mutate(auto.id)}
                    disabled={runMutation.isPending}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" /> Çalıştır
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={(props) => (
                        <Button
                          {...props}
                          size="icon-touch"
                          variant="ghost"
                          aria-label={`${auto.title} aksiyonları`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setHistoryId(auto.id)}>
                        <History className="mr-2 h-4 w-4" /> Geçmişi görüntüle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyWebhookUrl.mutate(auto.id)}>
                        <Webhook className="mr-2 h-4 w-4" /> Webhook URL kopyala
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          toggleMutation.mutate({ id: auto.id, enabled: !auto.enabled })
                        }
                      >
                        {auto.enabled ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" /> Duraklat
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" /> Sürdür
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(auto.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Sil
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
            title={`${tabs.find((tab) => tab.id === activeTab)?.label ?? 'Otomasyon'} otomasyon yok`}
            description="Dosya işleme, rapor veya yedek gibi AI görevleri için otomasyon oluşturun."
            action={{
              label: 'Otomasyon oluştur',
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
          <DialogTitle>Çalışma geçmişi</DialogTitle>
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
                const duration = run.durationMs ? formatRunDuration(run.durationMs) : '—';
                return (
                  <div key={run.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={variant} dot>
                          {runStatusLabels[run.status]}
                        </StatusBadge>
                        <span className="text-muted-foreground">{run.trigger}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(run.createdAt).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>Süre: {duration}</span>
                    </div>
                    {run.error && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                        {run.error}
                      </pre>
                    )}
                    {run.output && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs text-foreground/80">
                        {run.output}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz çalışma kaydı yok.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
