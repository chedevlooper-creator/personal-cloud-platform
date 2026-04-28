'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
  url?: string | null;
  updatedAt: string;
};

type BrowserSession = {
  id: string;
  url?: string;
  title?: string;
  createdAt: string;
  lastActiveAt: string;
};

type Automation = {
  id: string;
  name: string;
  schedule: string;
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
  icon: React.ComponentType<{ className?: string }>;
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

  const servicesQuery = useQuery({
    queryKey: ['computer', 'hosted-services'],
    queryFn: async () => (await publishApi.get('/hosted-services')).data as HostedService[],
    retry: false,
  });

  const browserQuery = useQuery({
    queryKey: ['computer', 'browser-sessions'],
    queryFn: async () => (await browserApi.get('/browser/sessions')).data as BrowserSession[],
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

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const services = servicesQuery.data ?? [];
  const browserSessions = browserQuery.data ?? [];
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
          <h1 className="text-2xl font-bold tracking-tight">Computer</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A live snapshot of everything currently running for you: workspaces, hosted services,
            cloud browser sessions, and scheduled automations.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Server}
          label="Workspaces"
          value={workspaces.length}
          href="/workspaces"
          caption={
            workspaces.length > 0
              ? `${formatBytes(totalStorage)} used across all workspaces`
              : 'No workspaces yet'
          }
        />
        <StatTile
          icon={Globe2}
          label="Hosted services"
          value={`${runningServices}/${services.length}`}
          href="/hosting"
          caption={
            services.length > 0
              ? `${runningServices} running, ${services.length - runningServices} stopped`
              : 'Nothing deployed'
          }
        />
        <StatTile
          icon={Globe}
          label="Browser sessions"
          value={browserSessions.length}
          href="/browser"
          caption={
            browserSessions[0]?.url
              ? (() => {
                  try {
                    return `Latest: ${new URL(browserSessions[0]!.url!).hostname}`;
                  } catch {
                    return 'Active';
                  }
                })()
              : 'No active sessions'
          }
        />
        <StatTile
          icon={Clock3}
          label="Automations"
          value={`${enabledAutomations}/${automations.length}`}
          href="/automations"
          caption={
            automations.length > 0
              ? `${enabledAutomations} enabled, ${automations.length - enabledAutomations} paused`
              : 'No automations yet'
          }
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Hosted services</h2>
            </div>
            <Link
              href="/hosting"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage →
            </Link>
          </div>
          {servicesQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : services.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No services deployed yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {services.slice(0, 5).map((svc) => (
                <li key={svc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{svc.name}</div>
                    {svc.url ? (
                      <a
                        href={svc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-muted-foreground hover:text-foreground"
                      >
                        {svc.url}
                      </a>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      svc.status === 'running'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
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
              <h2 className="text-sm font-semibold text-foreground">Browser sessions</h2>
            </div>
            <Link
              href="/browser"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open →
            </Link>
          </div>
          {browserQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : browserSessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No active sessions.</div>
          ) : (
            <ul className="divide-y divide-border">
              {browserSessions.slice(0, 5).map((s) => (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="truncate font-medium text-foreground">
                    {s.title || s.url || s.id}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Last active {formatDate(s.lastActiveAt)}
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
              <h2 className="text-sm font-semibold text-foreground">Automations</h2>
            </div>
            <Link
              href="/automations"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage →
            </Link>
          </div>
          {automationsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : automations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No automations scheduled.</div>
          ) : (
            <ul className="divide-y divide-border">
              {automations.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.schedule}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      a.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {a.enabled ? 'enabled' : 'paused'}
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
              <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
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
                  <Boxes className="h-4 w-4" /> Space (storage &amp; resources)
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
                  <Camera className="h-4 w-4" /> Snapshots
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
                  <Database className="h-4 w-4" /> Datasets
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
                  <Sparkles className="h-4 w-4" /> Skills
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
