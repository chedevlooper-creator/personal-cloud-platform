'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  ArrowRight,
  Boxes,
  Camera,
  Clock3,
  Cpu,
  Database,
  Globe,
  Globe2,
  Layers3,
  Server,
  Sparkles,
} from 'lucide-react';
import { agentApi, browserApi, publishApi, workspaceApi } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';

type Workspace = {
  id: string;
  name: string;
  storageUsed: number;
  storageLimit: number;
  updatedAt: string;
};

type WorkspacesResponse = {
  workspaces: Workspace[];
};

type HostedService = {
  id: string;
  name: string;
  status: string;
  publicUrl?: string | null;
  updatedAt: string;
};

type BrowserSession = {
  id: string;
  url?: string;
  title?: string;
  createdAt: string;
  lastUsedAt: string;
};

type Automation = {
  id: string;
  title: string;
  scheduleType: string;
  cronExpression?: string | null;
  intervalSeconds?: number | null;
  enabled: boolean;
  lastRunAt: string | null;
};

function StatTile({
  icon: Icon,
  label,
  value,
  href,
  caption,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  href?: string;
  caption?: string;
}) {
  const inner = (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-foreground/30">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
        {caption ? (
          <div className="mt-1 truncate text-xs text-muted-foreground">{caption}</div>
        ) : null}
      </div>
      {href ? <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" /> : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function ComputerPage() {
  const workspacesQuery = useQuery({
    queryKey: ['computer', 'workspaces'],
    queryFn: async () => (await workspaceApi.get('/workspaces')).data as WorkspacesResponse,
    retry: false,
  });

  const workspaces = workspacesQuery.data?.workspaces ?? [];

  // Hosted services are scoped per-workspace; fetch in parallel.
  const servicesResults = useQueries({
    queries: workspaces.map((w) => ({
      queryKey: ['computer', 'hosted-services', w.id],
      queryFn: async () => {
        const res = await publishApi.get('/hosted-services', {
          params: { workspaceId: w.id },
        });
        return (Array.isArray(res.data) ? res.data : (res.data?.services ?? [])) as HostedService[];
      },
      retry: false,
    })),
  });
  const servicesLoading = servicesResults.some((r) => r.isLoading);
  const servicesError = servicesResults.some((r) => r.isError) || workspacesQuery.isError;
  const services = servicesResults.flatMap((r) => r.data ?? []);

  const browserQuery = useQuery({
    queryKey: ['computer', 'browser-sessions'],
    queryFn: async () => {
      const res = await browserApi.get('/browser/sessions');
      return (res.data?.sessions ?? res.data ?? []) as BrowserSession[];
    },
    retry: false,
  });

  const automationsQuery = useQuery({
    queryKey: ['computer', 'automations'],
    queryFn: async () => {
      const res = await agentApi.get('/automations');
      return (res.data?.automations ?? res.data ?? []) as Automation[];
    },
    retry: false,
  });

  const browserSessions = Array.isArray(browserQuery.data) ? browserQuery.data : [];
  const automations = Array.isArray(automationsQuery.data) ? automationsQuery.data : [];

  const runningServices = services.filter((s) => s.status === 'running').length;
  const enabledAutomations = automations.filter((a) => a.enabled).length;
  const totalStorage = workspaces.reduce((sum, w) => sum + (w.storageUsed ?? 0), 0);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bilgisayar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Çalışma alanları, yayınlanan servisler, bulut tarayıcı oturumları ve otomasyonlar için canlı sistem özeti.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Server}
          label="Çalışma alanları"
          value={workspaces.length}
          href="/workspaces"
          caption={
            workspacesQuery.isError
              ? 'Workspace servisine ulaşılamıyor'
              : workspaces.length > 0
                ? `${formatBytes(totalStorage)} kullanılıyor`
                : 'Henüz çalışma alanı yok'
          }
        />
        <StatTile
          icon={Globe2}
          label="Servisler"
          value={`${runningServices}/${services.length}`}
          href="/hosting"
          caption={
            servicesError
              ? 'Publish servisine ulaşılamıyor'
              : services.length > 0
                ? `${runningServices} çalışıyor, ${services.length - runningServices} durdu`
                : 'Yayınlanan servis yok'
          }
        />
        <StatTile
          icon={Globe}
          label="Tarayıcı oturumları"
          value={browserSessions.length}
          href="/browser"
          caption={
            browserSessions[0]?.url
              ? (() => {
                  try {
                    return `Son: ${new URL(browserSessions[0]!.url!).hostname}`;
                  } catch {
                    return 'Aktif';
                  }
                })()
              : browserQuery.isError
                ? 'Browser servisine ulaşılamıyor'
                : 'Aktif oturum yok'
          }
        />
        <StatTile
          icon={Clock3}
          label="Otomasyonlar"
          value={`${enabledAutomations}/${automations.length}`}
          href="/automations"
          caption={
            automations.length > 0
              ? `${enabledAutomations} aktif, ${automations.length - enabledAutomations} duraklatıldı`
              : automationsQuery.isError
                ? 'Agent servisine ulaşılamıyor'
                : 'Otomasyon yok'
          }
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Servisler</h2>
            </div>
            <Link
              href="/hosting"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Yönet
            </Link>
          </div>
          {servicesLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Servisler yükleniyor...</div>
          ) : servicesError ? (
            <div className="p-4 text-sm text-destructive">Publish servisine ulaşılamıyor.</div>
          ) : services.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Henüz servis yayınlanmadı.</div>
          ) : (
            <ul className="divide-y divide-border">
              {services.slice(0, 5).map((svc) => (
                <li key={svc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{svc.name}</div>
                    {svc.publicUrl ? (
                      <a
                        href={svc.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-muted-foreground hover:text-foreground"
                      >
                        {svc.publicUrl}
                      </a>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      svc.status === 'running'
                        ? 'bg-success/15 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {svc.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Tarayıcı oturumları</h2>
            </div>
            <Link
              href="/browser"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Aç
            </Link>
          </div>
          {browserQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Oturumlar yükleniyor...</div>
          ) : browserQuery.isError ? (
            <div className="p-4 text-sm text-destructive">Browser servisine ulaşılamıyor.</div>
          ) : browserSessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Aktif oturum yok.</div>
          ) : (
            <ul className="divide-y divide-border">
              {browserSessions.slice(0, 5).map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="truncate font-medium text-foreground">
                    {s.title || s.url || s.id}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Son aktivite {formatDate(s.lastUsedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Otomasyonlar</h2>
            </div>
            <Link
              href="/automations"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Yönet
            </Link>
          </div>
          {automationsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Otomasyonlar yükleniyor...</div>
          ) : automationsQuery.isError ? (
            <div className="p-4 text-sm text-destructive">Agent servisine ulaşılamıyor.</div>
          ) : automations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Planlanmış otomasyon yok.</div>
          ) : (
            <ul className="divide-y divide-border">
              {automations.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.scheduleType === 'cron'
                        ? (a.cronExpression ?? 'cron')
                        : a.scheduleType === 'interval'
                          ? `${a.intervalSeconds ?? '?'} saniyede bir`
                          : a.scheduleType}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      a.enabled
                        ? 'bg-success/15 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {a.enabled ? 'aktif' : 'duraklatıldı'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Hızlı bağlantılar</h2>
            </div>
          </div>
          <ul className="divide-y divide-border">
            <li>
              <Link
                href="/terminal"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span>Terminal</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link
                href="/space"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Alan ve kaynaklar
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link
                href="/snapshots"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Anlık görüntüler
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link
                href="/datasets"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" /> Veri setleri
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
            <li>
              <Link
                href="/skills"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Yetenekler
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
