import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { internalRequest } from '../clients/http';
import { env } from '../env';

interface SessionDto {
  id: string;
  url: string;
  title: string;
}

interface ExtractDto {
  url: string;
  title: string;
  text: string;
  links: Array<{ href: string; text: string }>;
}

async function ensureSession(userId: string, sessionId?: string): Promise<string> {
  if (sessionId) return sessionId;
  const created = await internalRequest<SessionDto>(env.BROWSER_SERVICE_URL, {
    userId,
    method: 'POST',
    path: '/api/browser/sessions',
  });
  return created.id;
}

const openSchema = z.object({
  url: z.string().url().describe('http(s) URL to open'),
  sessionId: z.string().uuid().optional(),
});

export class BrowserOpenTool implements Tool<z.infer<typeof openSchema>, string> {
  name = 'browser_open';
  description =
    'Open or navigate a cloud browser session to a URL. Reuses sessionId when provided, otherwise creates one.';
  requiresApproval = false;
  schema = openSchema;
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          sessionId: { type: 'string' },
        },
        required: ['url'],
      },
    };
  }
  async execute(input: z.infer<typeof openSchema>, ctx: ToolContext): Promise<string> {
    const sessionId = await ensureSession(ctx.userId, input.sessionId);
    const s = await internalRequest<SessionDto>(env.BROWSER_SERVICE_URL, {
      userId: ctx.userId,
      method: 'POST',
      path: `/api/browser/sessions/${sessionId}/navigate`,
      body: { url: input.url },
    });
    return JSON.stringify({ sessionId: s.id, url: s.url, title: s.title });
  }
}

const extractSchema = z.object({ sessionId: z.string().uuid() });

export class BrowserExtractTool implements Tool<z.infer<typeof extractSchema>, string> {
  name = 'browser_extract';
  description =
    'Extract visible text and a list of links from the current page in a browser session. Returns trimmed text + up to 100 links.';
  requiresApproval = false;
  schema = extractSchema;
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    };
  }
  async execute(input: z.infer<typeof extractSchema>, ctx: ToolContext): Promise<string> {
    const r = await internalRequest<ExtractDto>(env.BROWSER_SERVICE_URL, {
      userId: ctx.userId,
      method: 'GET',
      path: `/api/browser/sessions/${input.sessionId}/extract`,
    });
    const linksLine = r.links
      .slice(0, 25)
      .map((l) => `- [${l.text}](${l.href})`)
      .join('\n');
    return `# ${r.title}\n${r.url}\n\n${r.text}\n\nLinks:\n${linksLine}`;
  }
}

const screenshotSchema = z.object({ sessionId: z.string().uuid() });

export class BrowserScreenshotTool implements Tool<z.infer<typeof screenshotSchema>, string> {
  name = 'browser_screenshot';
  description = 'Take a PNG screenshot of the current page. Returns size and a usable preview hint.';
  requiresApproval = false;
  schema = screenshotSchema;
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    };
  }
  async execute(input: z.infer<typeof screenshotSchema>, ctx: ToolContext): Promise<string> {
    const r = await internalRequest<{ pngBase64: string }>(env.BROWSER_SERVICE_URL, {
      userId: ctx.userId,
      method: 'GET',
      path: `/api/browser/sessions/${input.sessionId}/screenshot`,
    });
    const bytes = Math.floor((r.pngBase64.length * 3) / 4);
    return `Captured PNG (${bytes} bytes). Display via /api/browser/sessions/${input.sessionId}/screenshot.`;
  }
}

const clickSchema = z.object({
  sessionId: z.string().uuid(),
  selector: z.string().min(1).max(500).describe('CSS selector or text= selector'),
});

export class BrowserClickTool implements Tool<z.infer<typeof clickSchema>, string> {
  name = 'browser_click';
  description = 'Click an element by selector. Requires user approval.';
  requiresApproval = true;
  schema = clickSchema;
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          selector: { type: 'string' },
        },
        required: ['sessionId', 'selector'],
      },
    };
  }
  async execute(input: z.infer<typeof clickSchema>, ctx: ToolContext): Promise<string> {
    const s = await internalRequest<SessionDto>(env.BROWSER_SERVICE_URL, {
      userId: ctx.userId,
      method: 'POST',
      path: `/api/browser/sessions/${input.sessionId}/click`,
      body: { selector: input.selector },
    });
    return `Clicked. Now at ${s.url} (${s.title})`;
  }
}

const fillSchema = z.object({
  sessionId: z.string().uuid(),
  selector: z.string().min(1).max(500),
  value: z.string().max(10000),
});

export class BrowserFillTool implements Tool<z.infer<typeof fillSchema>, string> {
  name = 'browser_fill';
  description = 'Fill a form field by selector. Requires user approval.';
  requiresApproval = true;
  schema = fillSchema;
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          selector: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['sessionId', 'selector', 'value'],
      },
    };
  }
  async execute(input: z.infer<typeof fillSchema>, ctx: ToolContext): Promise<string> {
    await internalRequest<SessionDto>(env.BROWSER_SERVICE_URL, {
      userId: ctx.userId,
      method: 'POST',
      path: `/api/browser/sessions/${input.sessionId}/fill`,
      body: { selector: input.selector, value: input.value },
    });
    return `Filled "${input.selector}".`;
  }
}
