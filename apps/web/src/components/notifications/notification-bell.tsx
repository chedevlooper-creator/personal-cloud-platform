'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { agentApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  severity: 'info' | 'success' | 'warning' | 'error';
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await agentApi.get('/notifications/unread-count');
      return res.data as { count: number };
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await agentApi.get('/notifications', { params: { limit: 20 } });
      return res.data as { notifications: Notification[] };
    },
    refetchInterval: open ? 10_000 : 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      toast.error('Failed to mark notification as read');
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await agentApi.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      toast.error('Failed to mark all as read');
    },
  });

  const unread = countData?.count ?? 0;
  const items = data?.notifications ?? [];

  function handleNotificationClick(n: Notification) {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Notifications"
            aria-label="Notifications"
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-info px-1 text-[9px] font-medium text-info-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Notifications</span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            items.map((n) => {
              const SeverityIcon =
                n.severity === 'error'
                  ? AlertCircle
                  : n.severity === 'success'
                    ? CheckCircle2
                    : n.severity === 'warning'
                      ? AlertTriangle
                      : Info;
              const severityClass =
                n.severity === 'error'
                  ? 'text-destructive'
                  : n.severity === 'success'
                    ? 'text-success'
                    : n.severity === 'warning'
                      ? 'text-warning dark:text-warning'
                      : 'text-info';
              const severityLabel =
                n.severity === 'error'
                  ? 'Error'
                  : n.severity === 'success'
                    ? 'Success'
                    : n.severity === 'warning'
                      ? 'Warning'
                      : 'Info';
              const isClickable = Boolean(n.link);
              return (
                <div
                  key={n.id}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => isClickable && handleNotificationClick(n)}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }
                  }}
                  className={cn(
                    'group flex items-start gap-2 border-b border-border/50 px-3 py-2.5 last:border-0',
                    !n.readAt && 'bg-muted/30',
                    isClickable && 'cursor-pointer hover:bg-muted/50',
                  )}
                >
                  <SeverityIcon
                    className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', severityClass)}
                    aria-label={severityLabel}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{n.title}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    )}
                    {n.link && (
                      <span className="mt-1 inline-block text-[11px] text-primary">
                        Open →
                      </span>
                    )}
                  </div>
                  {!n.readAt && (
                    <button
                      type="button"
                      title="Mark as read"
                      aria-label="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Check className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
