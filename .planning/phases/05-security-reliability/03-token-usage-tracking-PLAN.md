---
phase: 5
plan: 03
name: token-usage-tracking
objective: Track and limit LLM token usage per user with monthly quotas
gap_closure: true
autonomous: true
wave: 1
cross_ai: false
files_modified:
  - services/agent/src/orchestrator.ts
  - services/agent/src/llm/types.ts
  - packages/db/src/schema/provider_credentials.ts
  - services/agent/src/routes.ts
---

# Plan 05-03: Token Usage Tracking

## Objective

Track LLM token consumption per user, enforce monthly quotas, and expose usage dashboards. Prevent runaway costs from automation loops or user abuse.

## Background

The agent loop already collects `accumulatedUsage` (promptTokens, completionTokens, totalTokens) and stores it in task metadata. However:
- No persistent tracking across tasks
- No monthly limits or quotas
- No way for users to see their usage
- No enforcement when limit is reached

## Tasks

### Task 1: Add usage tracking table (0.5h)

Add to `packages/db/src/schema/provider_credentials.ts` (or new file):

```ts
export const tokenUsage = pgTable('token_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  yearMonth: varchar('year_month', { length: 7 }).notNull(), // YYYY-MM
  provider: varchar('provider', { length: 32 }).notNull(),
  model: varchar('model', { length: 120 }),
  promptTokens: integer('prompt_tokens').default(0).notNull(),
  completionTokens: integer('completion_tokens').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  requestCount: integer('request_count').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userMonthIdx: index('token_usage_user_month_idx').on(t.userId, t.yearMonth),
}));
```

Generate migration:
```bash
pnpm --filter @pcp/db generate
```

### Task 2: Persist usage after each agent run (1h)

In `orchestrator.ts`, after task completion/failure, persist usage:

```ts
private async recordTokenUsage(
  userId: string,
  provider: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  await db.insert(tokenUsage)
    .values({
      userId,
      yearMonth,
      provider,
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [tokenUsage.userId, tokenUsage.yearMonth, tokenUsage.provider],
      set: {
        promptTokens: sql`${tokenUsage.promptTokens} + ${usage.promptTokens}`,
        completionTokens: sql`${tokenUsage.completionTokens} + ${usage.completionTokens}`,
        totalTokens: sql`${tokenUsage.totalTokens} + ${usage.totalTokens}`,
        requestCount: sql`${tokenUsage.requestCount} + 1`,
        updatedAt: new Date(),
      },
    });
}
```

### Task 3: Add quota check before LLM calls (1h)

Add `monthlyTokenQuota` to `userPreferences` table (default: 100,000).

Before each `llm.generate()` call, check quota:

```ts
private async assertTokenQuota(userId: string, provider: string): Promise<void> {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const usage = await db.query.tokenUsage.findFirst({
    where: and(
      eq(tokenUsage.userId, userId),
      eq(tokenUsage.yearMonth, yearMonth),
      eq(tokenUsage.provider, provider),
    ),
  });
  
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  
  const quota = prefs?.monthlyTokenQuota ?? 100_000;
  const used = usage?.totalTokens ?? 0;
  
  if (used >= quota) {
    throw new Error(
      `Monthly token quota exceeded: ${used.toLocaleString()} / ${quota.toLocaleString()} tokens. ` +
      `Quota resets on the 1st of next month.`,
    );
  }
}
```

### Task 4: Add usage endpoint (0.5h)

`GET /agent/usage` — returns current month's usage:

```ts
{
  month: "2026-04",
  quotas: {
    openai: { limit: 100000, used: 45231 },
    anthropic: { limit: 100000, used: 12034 },
  },
  providers: [
    { provider: "openai", model: "gpt-4-turbo-preview", promptTokens: 30000, completionTokens: 15000, requests: 45 }
  ]
}
```

### Task 5: Frontend usage widget (0.5h)

Add to dashboard: progress bar showing token usage vs quota.

### Task 6: Tests (0.5h)

- Quota check allows calls under limit
- Quota check blocks calls over limit
- Usage aggregation is correct

## Success Criteria

- [ ] `token_usage` table exists with migration
- [ ] Every agent run persists token usage
- [ ] Monthly quota enforced before LLM calls
- [ ] `/agent/usage` endpoint returns current usage
- [ ] Frontend shows usage progress
- [ ] Tests verify quota enforcement
- [ ] `pnpm test` passes

## Deviations

If Drizzle `onConflictDoUpdate` is not available in this version, use `upsert` pattern manually (select → insert or update).

## Notes

- Quota resets monthly (not rolling window)
- Separate quotas per provider (user might have more OpenAI budget than Anthropic)
- Automation tasks count toward the user's quota
