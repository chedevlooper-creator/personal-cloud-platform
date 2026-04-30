'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { Users, FileText, Activity, Loader2, ShieldCheck, Clock, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

type AdminTab = 'users' | 'audit-logs' | 'runtime-events' | 'health';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await authApi.get('/admin/users');
      return res.data as { id: string; name: string | null; email: string; createdAt: string }[];
    },
    enabled: activeTab === 'users',
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const res = await authApi.get('/admin/audit-logs');
      return res.data as {
        id: string;
        userId: string | null;
        action: string;
        details: Record<string, unknown> | null;
        ipAddress: string | null;
        createdAt: string;
      }[];
    },
    enabled: activeTab === 'audit-logs',
  });

  const { data: runtimeEventsData, isLoading: runtimeEventsLoading } = useQuery({
    queryKey: ['admin-runtime-events'],
    queryFn: async () => {
      const res = await authApi.get('/admin/runtime-events');
      return res.data as {
        id: string;
        runtimeId: string;
        type: string;
        payload: Record<string, unknown> | null;
        createdAt: string;
      }[];
    },
    enabled: activeTab === 'runtime-events',
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['admin-health'],
    queryFn: async () => {
      const res = await authApi.get('/admin/health');
      return res.data as { status: string; dbConnected: boolean; uptime: number };
    },
    enabled: activeTab === 'health',
  });

  const tabs = [
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'audit-logs' as const, label: 'Audit Logs', icon: FileText },
    { id: 'runtime-events' as const, label: 'Runtime Events', icon: Server },
    { id: 'health' as const, label: 'System Health', icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Admin Panel</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">System administration and monitoring</p>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-4">Joined</div>
          </div>
          {usersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (usersData || []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No users found</div>
          ) : (
            <div className="divide-y divide-border">
              {(usersData || []).map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-12 gap-4 p-4 text-sm items-center hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-4 font-medium text-foreground">{u.name || '—'}</div>
                  <div className="col-span-4 text-muted-foreground font-mono text-xs">
                    {u.email}
                  </div>
                  <div className="col-span-4 text-muted-foreground text-xs flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit-logs' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div className="col-span-3">Action</div>
            <div className="col-span-3">User ID</div>
            <div className="col-span-2">IP</div>
            <div className="col-span-4">Time</div>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (logsData || []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No audit logs yet</div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {(logsData || []).map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-12 gap-4 p-4 text-sm items-center hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-3">
                    <StatusBadge
                      variant={
                        log.action.includes('login')
                          ? 'success'
                          : log.action.includes('failed')
                            ? 'error'
                            : log.action.includes('delete') || log.action.includes('REVOKE')
                              ? 'error'
                              : 'default'
                      }
                    >
                      {log.action}
                    </StatusBadge>
                  </div>
                  <div className="col-span-3 text-muted-foreground font-mono text-xs truncate">
                    {log.userId || '—'}
                  </div>
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {log.ipAddress || '—'}
                  </div>
                  <div className="col-span-4 text-muted-foreground text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runtime Events Tab */}
      {activeTab === 'runtime-events' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Runtime ID</div>
            <div className="col-span-5">Payload</div>
            <div className="col-span-2">Time</div>
          </div>
          {runtimeEventsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (runtimeEventsData || []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No runtime events yet</div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {(runtimeEventsData || []).map((evt) => (
                <div
                  key={evt.id}
                  className="grid grid-cols-12 gap-4 p-4 text-sm items-center hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-2">
                    <StatusBadge
                      variant={
                        evt.type === 'failed' || evt.type === 'security_violation'
                          ? 'error'
                          : evt.type === 'exec'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {evt.type}
                    </StatusBadge>
                  </div>
                  <div className="col-span-3 text-muted-foreground font-mono text-xs truncate">
                    {evt.runtimeId}
                  </div>
                  <div className="col-span-5 text-muted-foreground text-xs truncate">
                    {evt.payload ? JSON.stringify(evt.payload) : '—'}
                  </div>
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {new Date(evt.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {healthLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : healthData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <Activity
                  className={cn(
                    'mx-auto h-8 w-8 mb-2',
                    healthData.status === 'healthy' ? 'text-green-500' : 'text-red-500',
                  )}
                />
                <p className="text-sm font-semibold text-foreground capitalize">
                  {healthData.status}
                </p>
                <p className="text-xs text-muted-foreground mt-1">System Status</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div
                  className={cn(
                    'mx-auto h-8 w-8 rounded-full mb-2 flex items-center justify-center',
                    healthData.dbConnected
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500',
                  )}
                >
                  {healthData.dbConnected ? '✓' : '✗'}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {healthData.dbConnected ? 'Connected' : 'Disconnected'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Database</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <Clock className="mx-auto h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {Math.floor(healthData.uptime / 3600)}h{' '}
                  {Math.floor((healthData.uptime % 3600) / 60)}m
                </p>
                <p className="text-xs text-muted-foreground mt-1">Uptime</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Could not fetch health data. Are you an admin?
            </div>
          )}
        </div>
      )}
    </div>
  );
}
