import type { ChannelAdapter, ChannelKind } from './types';

/**
 * Telegram bot adapter using the HTTP Bot API directly (no SDK).
 * Inbound messages arrive via webhook (POST /channels/telegram/webhook).
 * Outbound replies use sendMessage.
 *
 * Token comes from env: TELEGRAM_BOT_TOKEN.
 */
export class TelegramAdapter implements ChannelAdapter {
  readonly kind: ChannelKind = 'telegram';

  constructor(private token: string) {
    if (!token) throw new Error('TelegramAdapter requires a bot token');
  }

  async sendReply(chatId: string, body: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        // Telegram caps single message at 4096 chars
        text: body.length > 4000 ? body.slice(0, 3990) + '\n\n…(truncated)' : body,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Telegram sendMessage failed: ${res.status} ${text.slice(0, 200)}`);
    }
  }

  /**
   * Returns the configured webhook URL, if a TELEGRAM_WEBHOOK_URL env is set.
   * Useful for the channels UI to display setup instructions.
   */
  static getWebhookUrl(): string | null {
    return process.env.TELEGRAM_WEBHOOK_URL ?? null;
  }

  static fromEnv(): TelegramAdapter | null {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;
    return new TelegramAdapter(token);
  }
}
