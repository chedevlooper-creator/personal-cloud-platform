import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { env } from '../env';

const PRIVATE_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
];

function isPrivateHost(hostname: string): boolean {
  if (PRIVATE_HOSTS.includes(hostname)) return true;
  // IPv4 private ranges
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true; // link-local
  if (/^fe80:/i.test(hostname)) return true;
  return false;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export class WebFetchTool implements Tool<{ url: string; mode?: 'text' | 'raw' }, string> {
  name = 'web_fetch';
  description =
    'Fetch a public HTTP(S) URL and return its body as text. HTML is stripped to readable text by default. Output capped to WEB_FETCH_MAX_BYTES.';
  requiresApproval = false;
  schema = z.object({
    url: z.string().url().describe('Absolute http(s) URL to fetch'),
    mode: z.enum(['text', 'raw']).optional().describe('text strips HTML; raw returns body as-is'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http(s) URL to fetch' },
          mode: { type: 'string', enum: ['text', 'raw'], description: 'text (default) strips HTML' },
        },
        required: ['url'],
      },
    };
  }

  async execute(
    input: { url: string; mode?: 'text' | 'raw' },
    _context: ToolContext,
  ): Promise<string> {
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      return `Invalid URL: ${input.url}`;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `Refusing to fetch non-http(s) URL: ${parsed.protocol}`;
    }
    if (isPrivateHost(parsed.hostname)) {
      return `Refusing to fetch private/internal host: ${parsed.hostname}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(parsed, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'CloudMindOS-Agent/0.1 (+https://github.com)' },
      });
      clearTimeout(timeout);

      const status = response.status;
      const contentType = response.headers.get('content-type') ?? '';
      const text = await response.text();
      const max = env.WEB_FETCH_MAX_BYTES;
      const body =
        input.mode === 'raw' || !/text\/html/i.test(contentType) ? text : stripHtml(text);
      const truncated = body.length > max ? `${body.slice(0, max)}\n[truncated]` : body;
      return `status=${status} content-type=${contentType}\n\n${truncated}`;
    } catch (err: any) {
      return `Fetch error: ${err?.message ?? String(err)}`;
    }
  }
}
