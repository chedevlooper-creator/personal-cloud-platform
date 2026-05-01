'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi, getApiErrorMessage } from '@/lib/api';

type AuditLog = {
  id: string;
  userId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function AuditLogPage() {
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['user-audit-logs', actionFilter],
    queryFn: async () => {
      const res = await authApi.get('/user/audit-logs', {
        params: actionFilter ? { action: actionFilter, limit: 200 } : { limit: 200 },
      });
      return res.data as AuditLog[];
    },
    retry: false,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!filter.trim()) return data;
    const q = filter.toLowerCase();
    return data.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        (log.ipAddress?.toLowerCase().includes(q) ?? false) ||
        JSON.stringify(log.details ?? {}).toLowerCase().includes(q),
    );
  }, [data, filter]);

  const actions = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.map((d) => d.action))).sort();
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <History className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Privileged actions on your account: tool runs, hosted-service changes, snapshot
            restores, channel links, BYOK key add/revoke, and login events.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search action, IP, or details..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            {getApiErrorMessage(error, 'Failed to load audit log.')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No entries.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((log) => (
              <div key={log.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    {log.action}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(log.createdAt)}
                    {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                  </span>
                </div>
                {log.details && Object.keys(log.details).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Showing the most recent 200 entries. Filter narrows by action server-side.
      </p>
    </div>
  );
}
