'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, Plus, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agentApi, toastApiError} from '@/lib/api';

type ChannelLink = {
  id: string;
  workspaceId: string | null;
  channel: string;
  externalId: string;
  label: string | null;
  enabled: boolean;
  createdAt: string;
};

type Status = {
  telegram: { enabled: boolean; webhookUrl: string | null };
};

export default function ChannelsPage() {
  const qc = useQueryClient();
  const [externalId, setExternalId] = useState('');
  const [labelText, setLabelText] = useState('');

  const { data: status } = useQuery({
    queryKey: ['channels-status'],
    queryFn: async () => {
      const res = await agentApi.get('/channels/status');
      return res.data as Status;
    },
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['channel-links'],
    queryFn: async () => {
      const res = await agentApi.get('/channels/links');
      return (res.data?.links ?? []) as ChannelLink[];
    },
    retry: false,
  });
  const links = data ?? [];

  const create = useMutation({
    mutationFn: async () => {
      await agentApi.post('/channels/links', {
        channel: 'telegram',
        externalId: externalId.trim(),
        label: labelText.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-links'] });
      toast.success('Telegram chat linked.');
      setExternalId('');
      setLabelText('');
    },
    onError: (e) => toastApiError(e, 'Could not link channel.'),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await agentApi.patch(`/channels/links/${id}`, { enabled });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channel-links'] }),
    onError: (e) => toastApiError(e, 'Could not update link.'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await agentApi.delete(`/channels/links/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channel-links'] });
      toast.success('Link removed.');
    },
    onError: (e) => toastApiError(e, 'Could not remove link.'),
  });

  const telegramOk = status?.telegram.enabled ?? false;
  const telegramHook = status?.telegram.webhookUrl ?? null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Channels</h2>
          <p className="text-sm text-muted-foreground">
            Reach the agent from outside the web UI. Link an external account here, then message
            the bot — replies come back automatically.
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4">
        <header className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Telegram</h3>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
              telegramOk
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning-foreground dark:text-warning'
            }`}
          >
            {telegramOk ? 'Bot configured' : 'Token missing'}
          </span>
        </header>

        {!telegramOk && (
          <div className="mb-3 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground dark:text-warning">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Set <code className="font-mono">TELEGRAM_BOT_TOKEN</code> on the agent service env,
              register a webhook to{' '}
              <code className="font-mono">/api/channels/telegram/webhook</code>, and restart.
            </span>
          </div>
        )}
        {telegramHook && (
          <p className="mb-3 break-all text-[11px] text-muted-foreground">
            Webhook URL: <code className="font-mono">{telegramHook}</code>
          </p>
        )}

        <ol className="mb-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            Open the bot in Telegram and send <code className="font-mono">/start</code>.
          </li>
          <li>
            Find your numeric chat id (e.g. via <code className="font-mono">@userinfobot</code>).
          </li>
          <li>Aşağıya yapıştırıp Zihinbulut hesabınıza bağlayın.</li>
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!externalId.trim()) return;
            create.mutate();
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="ch-id">Telegram chat id</Label>
            <Input
              id="ch-id"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="123456789"
              disabled={!telegramOk}
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="ch-label">Label (optional)</Label>
            <Input
              id="ch-label"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="My phone"
              disabled={!telegramOk}
            />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              type="submit"
              disabled={!telegramOk || create.isPending || !externalId.trim()}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {create.isPending ? 'Linking...' : 'Link chat'}
            </Button>
          </div>
        </form>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Linked accounts</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : links.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No links yet. Add a Telegram chat above to start receiving messages.
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                      {l.channel}
                    </span>
                    <span className="font-medium text-foreground">
                      {l.label || l.externalId}
                    </span>
                    {!l.enabled && (
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground dark:text-warning">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    External id: <code className="font-mono">{l.externalId}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={l.enabled}
                      onChange={(e) =>
                        toggle.mutate({ id: l.id, enabled: e.target.checked })
                      }
                    />
                    Enabled
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Remove this link?')) remove.mutate(l.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
