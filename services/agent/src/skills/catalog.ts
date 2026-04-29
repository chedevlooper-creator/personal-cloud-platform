/**
 * Built-in skill catalog. Users can one-click install any of these into their
 * personal skill library via POST /skills/install. Each entry maps to the
 * shape of CreateSkillDto (slug, name, description, triggers, bodyMarkdown).
 *
 * These are ship-with defaults — the user owns the installed copy and can
 * edit, disable, or delete it without affecting the catalog source.
 */

export type CatalogSkill = {
  slug: string;
  name: string;
  description: string;
  category: 'research' | 'coding' | 'writing' | 'data' | 'productivity';
  triggers: string[];
  bodyMarkdown: string;
};

export const SKILL_CATALOG: CatalogSkill[] = [
  {
    slug: 'research-topic',
    name: 'Research Topic',
    category: 'research',
    description: 'Multi-source research with structured summary and citations.',
    triggers: ['research', 'investigate', 'find out about', 'araştır', 'incele'],
    bodyMarkdown: `# Research Topic

When invoked, you are operating as a research analyst.

## Process
1. Decompose the topic into 3-5 focused sub-questions.
2. For each sub-question, use the \`web_search\` and \`fetch_url\` tools to gather at least 2 independent sources.
3. Cross-check facts. Flag contradictions explicitly.
4. Produce a structured report:
   - **Summary** (3-5 sentences)
   - **Key findings** (bulleted, each with a source citation)
   - **Open questions / unknowns**
   - **Sources** (numbered list with URL + access date)

## Output style
- Plain markdown, no preamble.
- Cite inline like \`[1]\`, \`[2]\`.
- Prefer primary sources over aggregators.
`,
  },
  {
    slug: 'code-review',
    name: 'Code Review',
    category: 'coding',
    description: 'Senior-level code review focused on correctness, security, and maintainability.',
    triggers: ['review', 'code review', 'audit', 'incele', 'gözden geçir'],
    bodyMarkdown: `# Code Review

When invoked, you are a senior staff engineer reviewing a change.

## Checklist (in order)
1. **Correctness** — does the code do what it claims? Any obvious bugs, off-by-ones, race conditions, unhandled errors?
2. **Security** — input validation, auth/tenant scoping, injection vectors, secret handling, SSRF, XSS.
3. **Resource safety** — leaks, unbounded loops, missing timeouts, missing pagination.
4. **Maintainability** — naming, layering, duplication, dead code, type safety.
5. **Tests** — does the change include tests? Are they meaningful?

## Output
- Group findings by severity: \`BLOCKER\`, \`MAJOR\`, \`MINOR\`, \`NIT\`.
- For each finding: file:line, what's wrong, suggested fix.
- End with a one-line verdict: \`APPROVE\`, \`REQUEST CHANGES\`, or \`COMMENT\`.

Skip nits if there are blockers. Be direct, no flattery.
`,
  },
  {
    slug: 'sql-query-builder',
    name: 'SQL Query Builder',
    category: 'data',
    description: 'Translates natural-language questions into safe parameterized SQL.',
    triggers: ['sql', 'query', 'database', 'sorgu', 'select'],
    bodyMarkdown: `# SQL Query Builder

When invoked, the user wants a SQL query.

## Process
1. If the schema is unknown, ask for it OR use \`read_file\` to inspect migration files in the workspace.
2. Pick the simplest dialect-compatible form. Default to PostgreSQL.
3. Always parameterize user input — never string-concatenate values.
4. Add \`LIMIT\` to exploratory queries.
5. Explain the query in 1-2 sentences after the code block.

## Output
\`\`\`sql
-- one-line intent
SELECT ...
\`\`\`
Then: short explanation, expected row shape, and any indexes the query relies on.

## Refuse
- Destructive queries (\`DROP\`, \`TRUNCATE\`, \`DELETE\` without WHERE) without explicit confirmation.
`,
  },
  {
    slug: 'summarize-document',
    name: 'Summarize Document',
    category: 'writing',
    description: 'Produces tiered summaries (TL;DR, key points, full) for long documents.',
    triggers: ['summarize', 'tldr', 'summary', 'özetle', 'kısa özet'],
    bodyMarkdown: `# Summarize Document

When invoked, the user has provided (or referenced) a document and wants a summary.

## Output format
\`\`\`
**TL;DR** (1-2 sentences, lead with the conclusion)

**Key points**
- 5-7 bullets, ordered by importance, not by appearance in the source

**Notable quotes** (optional, only if striking)
> "..."

**What's missing / unclear** (optional)
\`\`\`

## Rules
- Never invent facts. If something is unclear in the source, say so.
- Match the language of the source unless asked otherwise.
- Don't pad. If the document is short, the summary should be short.
`,
  },
  {
    slug: 'extract-data',
    name: 'Extract Structured Data',
    category: 'data',
    description: 'Pulls structured JSON from messy unstructured text (emails, transcripts, pages).',
    triggers: ['extract', 'parse', 'structured', 'json', 'çıkar'],
    bodyMarkdown: `# Extract Structured Data

When invoked, the user wants structured data extracted from unstructured text.

## Process
1. If a target schema was given, use it verbatim.
2. Otherwise, infer the schema from the request and confirm before extracting.
3. Process item-by-item. Don't merge.
4. For missing fields, use \`null\` — never guess.
5. Output strict JSON — no comments, no trailing commas.

## Output
\`\`\`json
{
  "items": [ ... ]
}
\`\`\`
Followed by a one-line note about any ambiguous rows.
`,
  },
  {
    slug: 'plan-task',
    name: 'Plan Task',
    category: 'productivity',
    description: 'Breaks an ambiguous goal into an executable, ordered plan with checkpoints.',
    triggers: ['plan', 'roadmap', 'breakdown', 'planla', 'adımları'],
    bodyMarkdown: `# Plan Task

When invoked, the user has a goal that needs decomposition before execution.

## Output
1. **Goal** (one sentence, restated to confirm understanding)
2. **Assumptions** (anything you're inferring; flag for confirmation)
3. **Steps** — numbered, each with:
   - Action verb start
   - Concrete deliverable
   - Estimated effort (S/M/L)
   - Dependencies on prior steps
4. **Risks** — top 3, each with a mitigation
5. **Definition of done** — checklist of measurable outcomes

Keep steps small enough to verify in isolation. Prefer 5-10 steps over 20.
`,
  },
  {
    slug: 'debug-error',
    name: 'Debug Error',
    category: 'coding',
    description: 'Methodically diagnoses errors with bisection and hypothesis testing.',
    triggers: ['debug', 'error', 'crash', 'fix', 'hata', 'çöz'],
    bodyMarkdown: `# Debug Error

When invoked, the user is stuck on an error.

## Process
1. **Restate** the error in your own words. Quote the exact stack/message.
2. **Locate** — which file, line, function? Use \`read_file\` if unsure.
3. **Hypothesize** — list 3 possible causes, ranked by likelihood, with a 1-line test for each.
4. **Verify cheapest first** — run \`run_command\` or read code to eliminate hypotheses.
5. **Patch** — propose the minimal fix. Never broaden the change.
6. **Regression** — recommend one test that would have caught this.

## Anti-patterns to flag
- "It works on my machine" → ask about env diff.
- Silent catch blocks → demand error visibility.
- Retry without backoff → call out as a smell.
`,
  },
  {
    slug: 'meeting-notes',
    name: 'Meeting Notes',
    category: 'writing',
    description: 'Converts a transcript into action-oriented meeting notes.',
    triggers: ['meeting', 'transcript', 'notes', 'toplantı', 'notlar'],
    bodyMarkdown: `# Meeting Notes

When invoked, the user has a meeting transcript or recording summary.

## Output format
\`\`\`
# {Topic} — {YYYY-MM-DD}
**Attendees**: ...
**Duration**: ...

## Decisions
- DECISION: ... (owner, deadline)

## Action items
- [ ] {Action} — @{owner} — {deadline}

## Discussion highlights
- bullet, bullet, bullet

## Open questions
- ...
\`\`\`

## Rules
- Only record decisions actually made. If unclear, list under "Open questions".
- Action items must have an owner. If none was assigned, mark \`@?\`.
- Strip pleasantries and tangents.
`,
  },
];
