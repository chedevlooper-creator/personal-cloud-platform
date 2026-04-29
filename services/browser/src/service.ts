import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from './env';

/**
 * In-memory pool of Playwright browser contexts. Playwright is lazy-loaded via an
 * indirect dynamic import so the service builds and the routes report a 503 when
 * the optional native dependency hasn't been installed.
 */

export interface BrowserSessionInfo {
  id: string;
  userId: string;
  url: string;
  title: string;
  createdAt: Date;
  lastUsedAt: Date;
}

interface InternalSession extends BrowserSessionInfo {
  context: any;
  page: any;
  timer?: NodeJS.Timeout;
}

let driverModule: any | null = null;
let driverError: string | null = null;

async function loadPlaywright(): Promise<any> {
  if (driverModule) return driverModule;
  try {
    const specifier = 'playwright';
    const mod = await (Function('s', 'return import(s)') as (s: string) => Promise<any>)(specifier);
    driverModule = mod;
    return mod;
  } catch (err) {
    driverError = `Playwright is not installed. Run "pnpm --filter @pcp/browser-service add playwright && pnpm --filter @pcp/browser-service exec playwright install chromium". Original error: ${(err as Error).message}`;
    throw new Error(driverError);
  }
}

export class BrowserService {
  private sessions = new Map<string, InternalSession>();

  constructor(
    private logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void },
  ) {}

  list(userId: string): BrowserSessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.userId === userId)
      .map(toInfo);
  }

  async createSession(userId: string): Promise<BrowserSessionInfo> {
    const userSessions = Array.from(this.sessions.values()).filter((s) => s.userId === userId);
    if (userSessions.length >= env.BROWSER_MAX_SESSIONS_PER_USER) {
      throw httpErr(429, `Session limit reached (${env.BROWSER_MAX_SESSIONS_PER_USER}). Close one first.`);
    }
    const pw = await loadPlaywright();
    const profileDir = path.resolve(env.BROWSER_PROFILE_DIR, userId);
    await fs.mkdir(profileDir, { recursive: true });

    // launchPersistentContext gives us cookie/login persistence per user.
    const context = await pw.chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      acceptDownloads: false,
    });
    const page = (await context.pages())[0] ?? (await context.newPage());

    const id = randomUUID();
    const session: InternalSession = {
      id,
      userId,
      url: 'about:blank',
      title: '',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      context,
      page,
    };
    this.armIdleTimer(session);
    this.sessions.set(id, session);
    return toInfo(session);
  }

  async navigate(userId: string, sessionId: string, url: string): Promise<BrowserSessionInfo> {
    const s = this.requireSession(userId, sessionId);
    if (!isSafeUrl(url)) throw httpErr(400, 'URL must be http(s) and not point at a private network.');
    await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    s.url = s.page.url();
    s.title = await s.page.title().catch(() => '');
    this.touch(s);
    return toInfo(s);
  }

  async click(userId: string, sessionId: string, selector: string): Promise<BrowserSessionInfo> {
    const s = this.requireSession(userId, sessionId);
    await s.page.click(selector, { timeout: 10000 });
    await s.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    s.url = s.page.url();
    s.title = await s.page.title().catch(() => '');
    this.touch(s);
    return toInfo(s);
  }

  async fill(
    userId: string,
    sessionId: string,
    selector: string,
    value: string,
  ): Promise<BrowserSessionInfo> {
    const s = this.requireSession(userId, sessionId);
    await s.page.fill(selector, value, { timeout: 10000 });
    this.touch(s);
    return toInfo(s);
  }

  async screenshot(userId: string, sessionId: string): Promise<{ pngBase64: string }> {
    const s = this.requireSession(userId, sessionId);
    const buf = await s.page.screenshot({ type: 'png', fullPage: false });
    this.touch(s);
    return { pngBase64: Buffer.from(buf).toString('base64') };
  }

  /** Extract trimmed visible text + a small set of links for LLM consumption. */
  async extract(userId: string, sessionId: string): Promise<{
    url: string;
    title: string;
    text: string;
    links: Array<{ href: string; text: string }>;
  }> {
    const s = this.requireSession(userId, sessionId);
    const result = await s.page.evaluate(() => {
      type LinkLike = { href?: string; innerText?: string };
      type BrowserDocLike = {
        body?: { innerText?: string };
        querySelectorAll: (selector: string) => ArrayLike<LinkLike>;
      };
      const doc = (globalThis as { document?: BrowserDocLike }).document;
      const text = String(doc?.body?.innerText ?? '').trim();
      const anchors = doc ? Array.from(doc.querySelectorAll('a[href]')) : [];
      const links = anchors
        .slice(0, 100)
        .map((a) => ({
          href: String(a.href ?? ''),
          text: String(a.innerText ?? '').trim().slice(0, 200),
        }))
        .filter((l: { href: string; text: string }) => l.href && l.text);
      return { text, links };
    });
    this.touch(s);
    return {
      url: s.page.url(),
      title: await s.page.title().catch(() => ''),
      text: result.text.length > 8000 ? result.text.slice(0, 8000) + '\n…(truncated)' : result.text,
      links: result.links,
    };
  }

  async close(userId: string, sessionId: string): Promise<void> {
    const s = this.requireSession(userId, sessionId);
    await this.disposeSession(s);
  }

  async closeAll(userId: string): Promise<number> {
    const mine = Array.from(this.sessions.values()).filter((s) => s.userId === userId);
    for (const s of mine) await this.disposeSession(s);
    return mine.length;
  }

  private requireSession(userId: string, id: string): InternalSession {
    const s = this.sessions.get(id);
    if (!s || s.userId !== userId) throw httpErr(404, 'Session not found');
    return s;
  }

  private touch(s: InternalSession) {
    s.lastUsedAt = new Date();
    this.armIdleTimer(s);
  }

  private armIdleTimer(s: InternalSession) {
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      this.disposeSession(s).catch((err) =>
        this.logger?.warn?.({ err, sessionId: s.id }, 'idle session disposal failed'),
      );
    }, env.BROWSER_SESSION_TIMEOUT_MS);
  }

  private async disposeSession(s: InternalSession) {
    if (s.timer) clearTimeout(s.timer);
    this.sessions.delete(s.id);
    try {
      await s.context.close();
    } catch (err) {
      this.logger?.warn?.({ err, sessionId: s.id }, 'context close failed');
    }
  }
}

function toInfo(s: InternalSession): BrowserSessionInfo {
  return {
    id: s.id,
    userId: s.userId,
    url: s.url,
    title: s.title,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
  };
}

function httpErr(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

/** Reject non-http(s) URLs and obvious private-network targets to limit SSRF surface. */
export function isSafeUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  let host = u.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return false;
  }
  // Block obvious private IPv4 ranges (best-effort; not a full SSRF firewall).
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  // IPv6 loopback / link-local / ULA
  if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false;
  return true;
}
