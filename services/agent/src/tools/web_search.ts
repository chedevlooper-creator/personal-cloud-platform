import { z } from 'zod';
import { Tool, ToolContext } from './registry';
import { ToolDefinition } from '../llm/types';
import { env } from '../env';

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

async function searchBrave(query: string, limit: number, apiKey: string): Promise<SearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(limit, 10)));
  const response = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }
  const data: any = await response.json();
  const items = data?.web?.results ?? [];
  return items.map((it: any) => ({
    title: String(it.title ?? ''),
    url: String(it.url ?? ''),
    snippet: typeof it.description === 'string' ? it.description : undefined,
  }));
}

async function searchTavily(query: string, limit: number, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: Math.min(limit, 10) }),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }
  const data: any = await response.json();
  const items = Array.isArray(data?.results) ? data.results : [];
  return items.map((it: any) => ({
    title: String(it.title ?? ''),
    url: String(it.url ?? ''),
    snippet: typeof it.content === 'string' ? it.content : undefined,
  }));
}

async function searchSerpApi(
  query: string,
  limit: number,
  apiKey: string,
): Promise<SearchResult[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', String(Math.min(limit, 10)));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpAPI search failed: ${response.status}`);
  }
  const data: any = await response.json();
  const items = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return items.map((it: any) => ({
    title: String(it.title ?? ''),
    url: String(it.link ?? ''),
    snippet: typeof it.snippet === 'string' ? it.snippet : undefined,
  }));
}

export class WebSearchTool implements Tool<{ query: string; limit?: number }, string> {
  name = 'web_search';
  description =
    'Search the public web and return a short list of titles, URLs and snippets. Configured via WEB_SEARCH_PROVIDER.';
  requiresApproval = false;
  schema = z.object({
    query: z.string().min(1).describe('Search query'),
    limit: z.number().int().min(1).max(10).optional().describe('Max results, default 5'),
  });

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results, default 5' },
        },
        required: ['query'],
      },
    };
  }

  async execute(
    input: { query: string; limit?: number },
    _context: ToolContext,
  ): Promise<string> {
    const provider = env.WEB_SEARCH_PROVIDER;
    if (provider === 'none') {
      return 'Web search is disabled (WEB_SEARCH_PROVIDER=none). Set WEB_SEARCH_PROVIDER and WEB_SEARCH_API_KEY to enable.';
    }
    const apiKey = env.WEB_SEARCH_API_KEY;
    if (!apiKey) {
      return `Web search misconfigured: provider=${provider} but WEB_SEARCH_API_KEY is not set.`;
    }
    const limit = input.limit ?? 5;
    try {
      let results: SearchResult[];
      if (provider === 'brave') results = await searchBrave(input.query, limit, apiKey);
      else if (provider === 'tavily') results = await searchTavily(input.query, limit, apiKey);
      else results = await searchSerpApi(input.query, limit, apiKey);

      if (results.length === 0) return `No results for: ${input.query}`;
      return results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`)
        .join('\n\n');
    } catch (err: any) {
      return `Web search error: ${err?.message ?? String(err)}`;
    }
  }
}
