/**
 * Thin client for the public skills.sh registry API.
 *
 * Docs: https://skills.sh/docs/api
 *
 * No API key is required for the rate-limited public endpoints; if the
 * operator sets `SKILLS_SH_API_KEY` we forward it as a Bearer token.
 *
 * The full skill detail endpoint returns a `files` array. We treat the
 * `SKILL.md` file as the body and parse a minimal YAML frontmatter
 * (`name:` and `description:`) to seed metadata on import.
 */

const BASE_URL = 'https://skills.sh/api/v1';

export type RegistrySkill = {
  id: string;
  slug: string;
  name: string;
  source: string;
  installs: number;
  sourceType: string;
  installUrl: string | null;
  url: string;
  isDuplicate?: boolean;
};

export type RegistrySkillFile = { path: string; contents: string };

export type RegistrySkillDetail = {
  id: string;
  source: string;
  slug: string;
  installs: number;
  hash: string | null;
  files: RegistrySkillFile[] | null;
};

function authHeaders(): Record<string, string> {
  const key = process.env.SKILLS_SH_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(
      `skills.sh ${path} failed: ${res.status} ${res.statusText} ${text}`.trim(),
    );
    (err as Error & { statusCode?: number }).statusCode = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export async function listSkills(view: 'all-time' | 'trending' | 'hot', perPage = 30) {
  const data = await request<{ data: RegistrySkill[] }>(
    `/skills?view=${encodeURIComponent(view)}&per_page=${perPage}`,
  );
  return data.data;
}

export async function searchSkills(query: string, limit = 30) {
  const data = await request<{ data: RegistrySkill[] }>(
    `/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return data.data;
}

export async function getCurated() {
  const data = await request<{ data: Array<{ owner: string; skills: RegistrySkill[] }> }>(
    `/skills/curated`,
  );
  // Flatten into a single skill list while keeping owner metadata in the source.
  return data.data.flatMap((g) => g.skills);
}

export async function getSkillDetail(id: string): Promise<RegistrySkillDetail> {
  // `id` is the {source}/{slug} path used by the API.
  return request<RegistrySkillDetail>(`/skills/${id}`);
}

/**
 * Parse a tiny subset of YAML frontmatter (just `key: value` pairs on
 * single lines, no nested structures). The skills.sh ecosystem follows
 * the Anthropic SKILL.md convention which keeps frontmatter flat.
 */
export function parseSkillMd(contents: string): {
  name: string | null;
  description: string | null;
  body: string;
} {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(contents);
  if (!match) return { name: null, description: null, body: contents };
  const [, frontmatter = '', body = ''] = match;
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key = '', rawValue = ''] = m;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key.toLowerCase()] = value;
  }
  return {
    name: meta.name ?? null,
    description: meta.description ?? null,
    body: body.trimStart(),
  };
}

/**
 * Build a slug that satisfies the local schema
 * (`^[a-z0-9][a-z0-9-_]*$`, max 120 chars). We prefix with the registry
 * source so different owners can publish a `quickstart` skill without
 * colliding inside one user's library.
 */
export function buildLocalSlug(source: string, slug: string): string {
  const raw = `${source}-${slug}`
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return raw || 'skill';
}
