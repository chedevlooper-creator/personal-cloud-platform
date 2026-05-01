'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Globe2,
  Play,
  RefreshCw,
  Rocket,
  Server,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkspaceSummary } from '@/components/workspace/create-workspace-dialog';
import { publishApi, workspaceApi, toastApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

type WorkspacesResponse = {
  workspaces: WorkspaceSummary[];
  page: number;
  limit: number;
};

type HostedService = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: string;
  kind: string;
  updatedAt: string;
  publicUrl?: string | null;
  autoRestart?: boolean;
  crashCount?: number;
  lastHealthAt?: string | null;
  lastHealthOk?: boolean | null;
};

const serviceKindLabels: Record<string, string> = {
  static: 'Static',
  vite: 'Vite',
  node: 'Node.js',
};

function getStatusLabel(status: string) {
  if (status === 'running') return 'Çalışıyor';
  if (status === 'starting') return 'Başlatılıyor';
  if (status === 'stopped') return 'Durdu';
  if (status === 'crashed') return 'Çöktü';
  return status;
}

function getStatusVariant(status: string): 'running' | 'pending' | 'stopped' | 'error' {
  if (status === 'running') return 'running';
  if (status === 'starting') return 'pending';
  if (status === 'crashed') return 'error';
  return 'stopped';
}

export default function HostingPage() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState('static');
  const [rootPath, setRootPath] = useState('/');
  const [startCommand, setStartCommand] = useState('');
  const [envVarsText, setEnvVarsText] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [workspaceId, setWorkspaceId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspaceApi.get('/workspaces');
      return res.data as WorkspacesResponse;
    },
  });

  const workspaces = useMemo(() => workspacesQuery.data?.workspaces ?? [], [workspacesQuery.data]);
  const defaultWorkspaceId = workspaceId || workspaces[0]?.id || '';

  const servicesQuery = useQuery({
    queryKey: ['hosted-services', defaultWorkspaceId],
    enabled: Boolean(user?.id && defaultWorkspaceId),
    retry: false,
    refetchInterval: 20_000,
    queryFn: async () => {
      const res = await publishApi.get('/hosted-services', {
        params: { workspaceId: defaultWorkspaceId },
      });
      return res.data as HostedService[];
    },
  });

  const services = servicesQuery.data ?? [];
  const hostingReady = Boolean(user?.id && !servicesQuery.isError);

  const workspaceNameById = useMemo(() => {
    return new Map(workspaces.map((w) => [w.id, w.name]));
  }, [workspaces]);

  const createService = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('You must be signed in.');
      const envVars = parseEnvVars(envVarsText);
      const trimmedStart = startCommand.trim();
      const trimmedDomain = customDomain.trim();
      await publishApi.post('/hosted-services', {
        workspaceId: defaultWorkspaceId,
        name: name.trim(),
        slug: normalizeSlug(slug || name),
        kind,
        rootPath,
        envVars,
        isPublic,
        ...(trimmedStart ? { startCommand: trimmedStart } : {}),
        ...(trimmedDomain ? { customDomain: trimmedDomain } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Servis oluşturuldu.');
      setShowCreate(false);
      setName('');
      setSlug('');
      setKind('static');
      setRootPath('/');
      setStartCommand('');
      setEnvVarsText('');
      setCustomDomain('');
      setIsPublic(true);
    },
    onError: (e) => toastApiError(e, 'Servis oluşturulamadı.'),
  });

  const startService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Servis başlatılıyor.');
    },
    onError: (e) => toastApiError(e, 'Servis başlatılamadı.'),
  });

  const stopService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Servis durduruldu.');
    },
    onError: (e) => toastApiError(e, 'Servis durdurulamadı.'),
  });

  const restartService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.post(`/hosted-services/${id}/restart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Servis yeniden başlatılıyor.');
    },
    onError: (e) => toastApiError(e, 'Servis yeniden başlatılamadı.'),
  });

  const updateAutoRestart = useMutation({
    mutationFn: async ({ id, autoRestart }: { id: string; autoRestart: boolean }) => {
      await publishApi.patch(`/hosted-services/${id}`, { autoRestart });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
    },
    onError: (e) => toastApiError(e, 'Servis güncellenemedi.'),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      await publishApi.delete(`/hosted-services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-services'] });
      toast.success('Servis silindi.');
      setDeleteTarget(null);
    },
    onError: (e) => toastApiError(e, 'Servis silinemedi.'),
  });

  const canCreate = hostingReady && Boolean(defaultWorkspaceId && name.trim());

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            Hosting
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace uygulamalarını yayınlanabilir servis olarak çalıştırın
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
          {workspaces.length > 1 ? (
            <div className="min-w-0 sm:min-w-64">
              <Label htmlFor="hosting-workspace-filter" className="sr-only">
                Workspace
              </Label>
              <select
                id="hosting-workspace-filter"
                value={defaultWorkspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                aria-label="Workspace"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button
            size="touch"
            variant="gradient"
            className="w-full sm:w-auto"
            onClick={() => setShowCreate((v) => !v)}
            disabled={!hostingReady || workspaces.length === 0}
            aria-expanded={showCreate}
          >
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            Servis oluştur
          </Button>
        </div>
      </div>

      {servicesQuery.isError && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning">
          Publish servisine ulaşılamıyor. Servis yanıt verene kadar hosting aksiyonları kapalı.
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) createService.mutate();
          }}
          className="mt-4 grid animate-fade-up gap-4 rounded-2xl border border-border/70 bg-card/70 p-5 backdrop-blur-md shadow-[0_4px_24px_-12px_color-mix(in_oklch,var(--foreground)_15%,transparent)] md:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Servis adı</Label>
            <Input
              id="svc-name"
              className="min-h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My App"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-slug">Slug (subdomain)</Label>
            <Input
              id="svc-slug"
              className="min-h-11"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={normalizeSlug(name || 'my-app')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-kind">Tür</Label>
            <select
              id="svc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="static">Static (HTML/CSS/JS)</option>
              <option value="vite">Vite App</option>
              <option value="node">Node.js API</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-root">Root path</Label>
            <Input
              id="svc-root"
              className="min-h-11"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-workspace">Workspace</Label>
            <select
              id="svc-workspace"
              value={defaultWorkspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <Label htmlFor="svc-start">Başlatma komutu (Node/Vite)</Label>
            <Input
              id="svc-start"
              className="min-h-11 font-mono text-sm"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              placeholder="npm start"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <Label htmlFor="svc-env">Ortam değişkenleri</Label>
            <Textarea
              id="svc-env"
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              placeholder={'KEY=value\nANOTHER_KEY=secret'}
              rows={4}
              className="min-h-32 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Satır başına bir <code>KEY=VALUE</code>. Değerler saklanırken şifrelenir.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-domain">Custom domain</Label>
            <Input
              id="svc-domain"
              className="min-h-11"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="app.example.com"
            />
          </div>
          <div className="flex min-h-11 items-center gap-2 pt-2 md:pt-6">
            <input
              id="svc-public"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Label htmlFor="svc-public" className="font-normal">
              Herkese açık
            </Label>
          </div>
          <div className="flex items-end md:justify-end">
            <Button
              type="submit"
              size="touch"
              className="w-full md:w-auto"
              disabled={!canCreate || createService.isPending}
            >
              {createService.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {servicesQuery.isLoading ? (
          <LoadingSkeleton variant="card" />
        ) : services.length > 0 ? (
          <div className="space-y-3">
            {services.map((svc) => {
              const isRunning = svc.status === 'running';
              const isStarting = svc.status === 'starting';
              return (
                <div
                  key={svc.id}
                  className="group/svc flex animate-fade-up flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-md transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_32px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)] sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate font-medium text-foreground">{svc.name}</h3>
                        <StatusBadge variant={getStatusVariant(svc.status)} dot>
                          {getStatusLabel(svc.status)}
                        </StatusBadge>
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                          {serviceKindLabels[svc.kind] ?? svc.kind}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        <span className="font-mono text-foreground/80">
                          {svc.slug}.apps.localhost
                        </span>
                        <span> · {workspaceNameById.get(svc.workspaceId) || 'Workspace'}</span>
                        <span> · {formatDate(svc.updatedAt)}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span
                          className={
                            svc.lastHealthOk === false
                              ? 'text-destructive'
                              : svc.lastHealthOk
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : ''
                          }
                          title={svc.lastHealthAt ?? undefined}
                        >
                          Sağlık:{' '}
                          {svc.lastHealthOk === null || svc.lastHealthOk === undefined
                            ? 'bekleniyor'
                            : svc.lastHealthOk
                              ? 'OK'
                              : 'hata'}
                        </span>
                        <span>Çökme: {svc.crashCount ?? 0}</span>
                        <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm focus-within:ring-2 focus-within:ring-ring sm:min-h-7">
                          <input
                            type="checkbox"
                            checked={svc.autoRestart ?? true}
                            onChange={(e) =>
                              updateAutoRestart.mutate({
                                id: svc.id,
                                autoRestart: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          Otomatik başlat
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                    {isRunning ? (
                      <>
                        <Button
                          size="touch"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => restartService.mutate(svc.id)}
                          disabled={restartService.isPending}
                          title="Yeniden başlat"
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Yeniden başlat
                        </Button>
                        <Button
                          size="touch"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => stopService.mutate(svc.id)}
                          disabled={stopService.isPending}
                        >
                          <Square className="mr-1 h-3.5 w-3.5" /> Durdur
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="touch"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => startService.mutate(svc.id)}
                        disabled={startService.isPending || isStarting}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Başlat
                      </Button>
                    )}
                    {svc.publicUrl && (
                      <a
                        href={svc.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'touch' }),
                          'w-full sm:w-auto',
                        )}
                      >
                        Aç <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button
                      size="icon-touch"
                      variant="ghost"
                      className="justify-self-end text-destructive hover:text-destructive sm:justify-self-auto"
                      onClick={() => setDeleteTarget(svc.id)}
                      title="Servisi sil"
                      aria-label={`${svc.name} servisini sil`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Globe2 className="h-6 w-6" />}
            title="Henüz servis yok"
            description="Mevcut bir workspace'ten static site, Vite uygulaması veya Node.js servisi oluşturun."
            action={{
              label: 'Servis oluştur',
              onClick: () => setShowCreate(true),
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Servisi sil"
        description="Çalışan container durdurulacak ve servis kaldırılacak. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await deleteService.mutateAsync(deleteTarget);
        }}
      />
    </div>
  );
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function parseEnvVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    // Strip matching surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
