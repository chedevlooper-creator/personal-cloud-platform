import type { EventBus, DomainEvent } from './events';

/**
 * Minimal redis-like surface required by {@link RedisEventBus}.
 */
export interface RedisPubSub {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;
  on(event: 'message', listener: (channel: string, message: string) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

const EVENT_CHANNEL = 'pcp:events';

/**
 * Redis-backed event bus using pub/sub.
 *
 * All events are serialised and broadcast on a single channel.
 * Handlers filter by `event.type` locally.
 */
export class RedisEventBus implements EventBus {
  private handlers = new Map<string, Array<(event: DomainEvent) => void | Promise<void>>>();
  private subscribed = false;

  constructor(private redis: RedisPubSub) {}

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    await this.redis.publish(EVENT_CHANNEL, JSON.stringify(event));
  }

  async subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void | Promise<void>,
  ): Promise<void> {
    if (!this.subscribed) {
      this.redis.on('message', (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as DomainEvent;
          const typeHandlers = this.handlers.get(parsed.type);
          if (typeHandlers) {
            for (const h of typeHandlers) {
              Promise.resolve(h(parsed)).catch((err) => {
                console.error('Event handler failed:', err);
              });
            }
          }
        } catch {
          // ignore malformed messages
        }
      });
      await this.redis.subscribe(EVENT_CHANNEL);
      this.subscribed = true;
    }

    const list = this.handlers.get(eventType) ?? [];
    list.push(handler as (event: DomainEvent) => void | Promise<void>);
    this.handlers.set(eventType, list);
  }
}
