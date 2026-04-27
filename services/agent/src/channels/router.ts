import { db } from '@pcp/db/src/client';
import { channelLinks, conversations, tasks, workspaces } from '@pcp/db/src/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AgentOrchestrator } from '../orchestrator';
import type { ChannelAdapter, IncomingMessage } from './types';

const POLL_INTERVAL_MS = 1500;
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

/**
 * Routes an inbound channel message to the agent and replies via the adapter.
 *
 * Steps:
 *  1. Look up channel_links row by (channel, externalId) → repo userId.
 *     If none, ignore (silent — link must be created from /channels first).
 *  2. Find or create the conversation matching (userId, channel, channelThreadId).
 *  3. Enqueue an agent task in the user's default workspace.
 *  4. Poll the task to completion (or timeout).
 *  5. Send the agent's output back via adapter.sendReply.
 */
export async function handleIncoming(
  msg: IncomingMessage,
  orchestrator: AgentOrchestrator,
  adapter: ChannelAdapter,
  logger: { info: Function; warn: Function; error: Function },
): Promise<void> {
  const link = await db.query.channelLinks.findFirst({
    where: and(
      eq(channelLinks.channel, msg.channel),
      eq(channelLinks.externalId, msg.externalUserId),
      eq(channelLinks.enabled, true),
    ),
  });

  if (!link) {
    logger.info(
      { channel: msg.channel, externalUserId: msg.externalUserId },
      'No channel link found; ignoring message',
    );
    try {
      await adapter.sendReply(
        msg.externalThreadId,
        'Bu hesap CloudMind ile eşleştirilmemiş. /channels sayfasından bağla.',
      );
    } catch {
      /* swallow */
    }
    return;
  }

  // Resolve workspace: explicit on the link, else user's first workspace.
  let workspaceId = link.workspaceId;
  if (!workspaceId) {
    const ws = await db.query.workspaces.findFirst({
      where: and(eq(workspaces.userId, link.userId), isNull(workspaces.deletedAt)),
      orderBy: (w, { asc }) => [asc(w.createdAt)],
    });
    if (!ws) {
      await adapter.sendReply(
        msg.externalThreadId,
        'CloudMind hesabınızda henüz bir workspace yok. Web arayüzünden bir tane oluşturun.',
      );
      return;
    }
    workspaceId = ws.id;
  }

  // Find existing conversation for this thread.
  let convo = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.userId, link.userId),
      eq(conversations.channel, msg.channel),
      eq(conversations.channelThreadId, msg.externalThreadId),
      isNull(conversations.archivedAt),
    ),
    orderBy: (c, { desc: d }) => [d(c.updatedAt)],
  });

  if (!convo) {
    const [created] = await db
      .insert(conversations)
      .values({
        userId: link.userId,
        workspaceId,
        title: msg.body.slice(0, 50),
        channel: msg.channel,
        channelThreadId: msg.externalThreadId,
      })
      .returning();
    if (!created) throw new Error('Failed to create conversation');
    convo = created;
  }

  const task = await orchestrator.createTask(link.userId, workspaceId, msg.body, convo.id);

  const reply = await waitForTaskCompletion(task.id, logger);

  try {
    await adapter.sendReply(msg.externalThreadId, reply);
  } catch (err) {
    logger.error({ err }, 'Failed to send channel reply');
  }
}

async function waitForTaskCompletion(
  taskId: string,
  logger: { warn: Function },
): Promise<string> {
  const deadline = Date.now() + TASK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!t) return 'Task kayboldu, tekrar dene.';
    if (t.status === 'completed') return t.output ?? '(boş yanıt)';
    if (t.status === 'failed') return `Hata: ${t.output ?? 'bilinmiyor'}`;
    if (t.status === 'cancelled') return 'Görev iptal edildi.';
    if (t.status === 'waiting_approval') {
      return 'Bu işlem onay bekliyor. Web arayüzünden onayla, sonra tekrar yaz.';
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  logger.warn({ taskId }, 'Task timed out waiting for channel reply');
  return 'Zaman aşımı oluştu — görev arka planda devam ediyor olabilir.';
}

export const __test__ = { POLL_INTERVAL_MS, TASK_TIMEOUT_MS };
// silence unused-export warning
void desc;
