/**
 * ChannelAdapter contract.
 *
 * A channel adapter wraps an external messaging surface (Telegram, email,
 * Discord, SMS) and produces normalized IncomingMessage events. Replies go
 * out via `sendReply`. Routing from externalUserId -> repo userId is handled
 * by the router, not the adapter.
 */

export type ChannelKind = 'telegram' | 'email' | 'discord' | 'sms';

export interface IncomingMessage {
  channel: ChannelKind;
  /** External account id (Telegram chat id, email From, Discord user id, etc.) */
  externalUserId: string;
  /** External thread id (Telegram chat id, email Message-Id, etc.) — used to resume conversations */
  externalThreadId: string;
  body: string;
  /** Display name from the channel, used when creating a new channel link */
  externalDisplayName?: string;
  receivedAt: Date;
}

export interface ChannelAdapter {
  readonly kind: ChannelKind;
  /** Send a reply back to the same thread the message came from. */
  sendReply(externalThreadId: string, body: string): Promise<void>;
}
