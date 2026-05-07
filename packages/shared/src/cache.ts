/**
 * Simple cache abstraction. Implementations may be backed by Redis,
 * in-memory maps, or other stores.
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Invalidate all keys that start with the given tag prefix. */
  taggedInvalidate(tag: string): Promise<void>;
}

/**
 * Minimal redis-like surface required by {@link RedisCache} so consumers
 * do not need a direct `ioredis` dependency.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  scanStream(options: { match: string; count?: number }): NodeJS.EventEmitter;
  pipeline(): {
    del(key: string): unknown;
    exec(): Promise<unknown[] | null>;
  };
}

/**
 * Redis-backed cache implementation. Values are JSON-serialised.
 * Tagged invalidation uses a prefix scan — keep tag cardinality low
 * in production (e.g. one tag per user or workspace, not per key).
 */
export class RedisCache implements Cache {
  constructor(private redis: RedisLike) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.setex(key, ttlSeconds, payload);
    } else {
      await this.redis.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async taggedInvalidate(tag: string): Promise<void> {
    const pattern = `${tag}:*`;
    const stream = this.redis.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: string[]) => keys.push(...chunk));
      stream.on('end', () => resolve());
      stream.on('error', (err: Error) => reject(err));
    });

    if (keys.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const k of keys) {
      pipeline.del(k);
    }
    await pipeline.exec();
  }
}

/** In-memory fallback for tests or single-node deployments. */
export class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async taggedInvalidate(tag: string): Promise<void> {
    const prefix = `${tag}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}
