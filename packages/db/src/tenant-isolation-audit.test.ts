import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

type RequiredPattern = {
  label: string;
  pattern: RegExp;
};

type TenantScopedModule = {
  path: string;
  rationale: string;
  required: RequiredPattern[];
};

const TENANT_SCOPED_MODULES: TenantScopedModule[] = [
  {
    path: 'services/auth/src/routes/profile.ts',
    rationale: 'current-user preferences, credentials, account, and audit-log routes',
    required: [
      { label: 'preferences are keyed by authenticated user', pattern: /eq\(userPreferences\.userId,\s*userId\)/ },
      { label: 'provider credentials are keyed by authenticated user', pattern: /eq\(providerCredentials\.userId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/workspace/src/service.ts',
    rationale: 'workspace, file, and snapshot data are owned by a user workspace',
    required: [
      { label: 'workspace ownership checks include userId', pattern: /eq\(workspaces\.userId,\s*userId\)/ },
      { label: 'object storage keys are tenant-prefixed', pattern: /\$\{userId\}\/\$\{workspaceId\}/ },
    ],
  },
  {
    path: 'services/workspace/src/routes/snapshots.ts',
    rationale: 'snapshot routes resolve the authenticated user and delegate with userId',
    required: [
      { label: 'route uses central auth resolver', pattern: /resolveAuthenticatedUserId\(request/ },
      { label: 'restore delegates with authenticated userId', pattern: /restoreSnapshot\(request\.params\.id,\s*userId\)/ },
    ],
  },
  {
    path: 'services/workspace/src/datasets/service.ts',
    rationale: 'datasets are stored in per-user DuckDB files and registry rows',
    required: [
      { label: 'dataset registry filters by userId', pattern: /eq\(datasets\.userId,\s*userId\)/ },
      { label: 'DuckDB path is derived from userId', pattern: /dbPathFor\(userId\)/ },
    ],
  },
  {
    path: 'services/runtime/src/service.ts',
    rationale: 'runtime rows and workspace materialization are user scoped',
    required: [
      { label: 'runtime row operations filter by userId', pattern: /eq\(runtimes\.userId,\s*userId\)/ },
      { label: 'workspace ownership is checked before runtime creation', pattern: /assertWorkspaceOwned\(workspaceId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/publish/src/service.ts',
    rationale: 'hosted services are user scoped and tied to owned workspaces',
    required: [
      { label: 'hosted service operations filter by userId', pattern: /eq\(hostedServices\.userId,\s*userId\)/ },
      { label: 'workspace ownership checked before create', pattern: /assertWorkspaceOwned\(data\.workspaceId,\s*data\.userId\)/ },
    ],
  },
  {
    path: 'services/publish/src/health.ts',
    rationale: 'background daemon scans system rows but uses row-sourced user ownership for side effects',
    required: [
      { label: 'notifications use row owner', pattern: /userId:\s*svc\.userId/ },
      { label: 'restart delegates with row owner', pattern: /startService\(svc\.id,\s*svc\.userId\)/ },
    ],
  },
  {
    path: 'services/memory/src/service.ts',
    rationale: 'memory entries and vector search are scoped to the authenticated user',
    required: [
      { label: 'memory mutations filter by userId', pattern: /eq\(memoryEntries\.userId,\s*userId\)/ },
      { label: 'raw vector search includes user_id predicate', pattern: /user_id\s*=\s*\$\{userId\}/ },
    ],
  },
  {
    path: 'services/agent/src/routes.ts',
    rationale: 'agent routes resolve a user and delegate tenant operations with that id',
    required: [
      { label: 'routes use authenticated user helper', pattern: /getAuthenticatedUserId\(request\.cookies\.sessionId\)/ },
      { label: 'usage query filters token usage by userId', pattern: /eq\(tokenUsage\.userId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/orchestrator.ts',
    rationale: 'tasks, conversations, tools, approvals, skills, and quotas are user scoped',
    required: [
      { label: 'task lookups filter by userId', pattern: /eq\(tasks\.userId,\s*userId\)/ },
      { label: 'workspace ownership is checked before task creation', pattern: /assertWorkspaceOwned\(workspaceId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/routes/automation.ts',
    rationale: 'automation CRUD is user scoped; public trigger is protected by HMAC then row owner',
    required: [
      { label: 'automation routes filter by userId', pattern: /eq\(automations\.userId,\s*userId\)/ },
      { label: 'public trigger validates HMAC token', pattern: /verifyAutomationTriggerToken\(id,\s*token\)/ },
      { label: 'public trigger checks workspace against automation owner', pattern: /assertWorkspaceOwned\(automation\.workspaceId,\s*automation\.userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/skills/service.ts',
    rationale: 'skills are user scoped',
    required: [{ label: 'skills filter by userId', pattern: /eq\(skills\.userId,\s*userId\)/ }],
  },
  {
    path: 'services/agent/src/routes/notifications.ts',
    rationale: 'notifications are user scoped',
    required: [{ label: 'notifications filter by userId', pattern: /eq\(notifications\.userId,\s*userId\)/ }],
  },
  {
    path: 'services/agent/src/routes/channels.ts',
    rationale: 'channel link management is user scoped',
    required: [
      { label: 'channel links filter by userId', pattern: /eq\(channelLinks\.userId,\s*userId\)/ },
      { label: 'workspace ownership checked on link writes', pattern: /assertWorkspaceOwned\(request\.body\.workspaceId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/channels/router.ts',
    rationale: 'public channel ingress resolves a linked row then uses the row owner',
    required: [
      { label: 'workspace fallback uses linked user', pattern: /eq\(workspaces\.userId,\s*link\.userId\)/ },
      { label: 'created conversations use linked user', pattern: /userId:\s*link\.userId/ },
      { label: 'completion polling uses linked user', pattern: /waitForTaskCompletion\(task\.id,\s*link\.userId/ },
    ],
  },
  {
    path: 'services/agent/src/personas/service.ts',
    rationale: 'personas are user scoped',
    required: [{ label: 'personas filter by userId', pattern: /eq\(personas\.userId,\s*userId\)/ }],
  },
  {
    path: 'services/agent/src/llm/credentials.ts',
    rationale: 'provider credentials and preferences are user scoped',
    required: [
      { label: 'credentials filter by userId', pattern: /eq\(providerCredentials\.userId,\s*userId\)/ },
      { label: 'preferences filter by userId', pattern: /eq\(userPreferences\.userId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/automation/queue.ts',
    rationale: 'background automation jobs derive and validate row owner before execution',
    required: [
      { label: 'trusted job data validates run owner', pattern: /assertAutomationRunOwned\(data\.runId,\s*data\.automationId,\s*data\.userId\)/ },
      { label: 'automation run ownership helper filters by userId', pattern: /eq\(automationRuns\.userId,\s*userId\)/ },
      { label: 'trusted job data validates workspace owner', pattern: /assertWorkspaceOwned\(data\.userId,\s*data\.workspaceId\)/ },
      { label: 'workspace ownership helper filters by userId', pattern: /eq\(workspaces\.userId,\s*userId\)/ },
    ],
  },
  {
    path: 'services/agent/src/automation/notify.ts',
    rationale: 'automation notifications are inserted for the run owner',
    required: [{ label: 'notification rows use run owner', pattern: /userId:\s*run\.userId/ }],
  },
];

const INTENTIONAL_SYSTEM_MODULES = new Map<string, string>([
  ['services/auth/src/service.ts', 'identity bootstrap uses email/session lookups before a tenant exists'],
  ['services/auth/src/routes/admin.ts', 'admin-only routes intentionally read system-wide user/audit/runtime views'],
]);

const REVIEWED_ROUTE_DB_MODULES = new Map<string, string>([
  ['services/agent/src/routes.ts', 'usage route aggregates authenticated user token usage'],
  ['services/agent/src/routes/automation.ts', 'automation CRUD currently lives in route layer with userId predicates'],
  ['services/agent/src/routes/channels.ts', 'channel link CRUD currently lives in route layer with userId predicates'],
  ['services/agent/src/routes/notifications.ts', 'notification reads are route-local but user-scoped'],
  ['services/auth/src/routes/admin.ts', 'admin-only route intentionally reads system-wide operational data'],
  ['services/auth/src/routes/profile.ts', 'current-user profile/settings routes are user-scoped'],
  ['services/workspace/src/routes/snapshots.ts', 'snapshot audit side effects are route-local and authenticated'],
]);

describe('tenant isolation audit', () => {
  it('keeps every direct service db module in the tenant-isolation inventory', () => {
    const expected = [...TENANT_SCOPED_MODULES.map((module) => module.path), ...INTENTIONAL_SYSTEM_MODULES.keys()].sort();

    expect(findDirectServiceDbModules()).toEqual(expected);
  });

  it.each(TENANT_SCOPED_MODULES)('$path documents and enforces tenant scoping', (module) => {
    expect(module.rationale.length).toBeGreaterThan(20);

    const source = readRepoFile(module.path);
    for (const requirement of module.required) {
      expect(source, `${module.path}: ${requirement.label}`).toMatch(requirement.pattern);
    }
  });

  it('requires explicit rationale for intentional system-wide db modules', () => {
    for (const [modulePath, rationale] of INTENTIONAL_SYSTEM_MODULES) {
      expect(readRepoFile(modulePath)).toContain("@pcp/db/src/client");
      expect(rationale.length).toBeGreaterThan(20);
    }
  });

  it('keeps direct DB access out of route files unless reviewed', () => {
    expect(findRouteDbModules()).toEqual([...REVIEWED_ROUTE_DB_MODULES.keys()].sort());
    for (const [modulePath, rationale] of REVIEWED_ROUTE_DB_MODULES) {
      expect(rationale.length).toBeGreaterThan(20);
      expect(readRepoFile(modulePath)).toContain('@pcp/db/src');
    }
  });
});

function findDirectServiceDbModules(): string[] {
  const serviceRoot = join(repoRoot(), 'services');
  return listTypeScriptFiles(serviceRoot)
    .map((filePath) => ({ filePath, source: readFileSync(filePath, 'utf8') }))
    .filter(({ source }) => importsDbClient(source) && /\bdb\s*\./.test(source))
    .map(({ filePath }) => relative(repoRoot(), filePath).split(sep).join('/'))
    .sort();
}

function listTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', 'coverage', '__tests__'].includes(entry.name)) continue;
      files.push(...listTypeScriptFiles(fullPath));
      continue;
    }

    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
    files.push(fullPath);
  }
  return files;
}

function importsDbClient(source: string): boolean {
  return /from ['"]@pcp\/db\/src\/client['"]/.test(source);
}

function findRouteDbModules(): string[] {
  const serviceRoot = join(repoRoot(), 'services');
  return listTypeScriptFiles(serviceRoot)
    .map((filePath) => ({ filePath, source: readFileSync(filePath, 'utf8') }))
    .filter(({ filePath, source }) => isRouteFile(filePath) && routeDoesDirectDbWork(source))
    .map(({ filePath }) => relative(repoRoot(), filePath).split(sep).join('/'))
    .sort();
}

function routeDoesDirectDbWork(source: string): boolean {
  return importsDbClient(source) || /from ['"]@pcp\/db\/src\/schema['"]/.test(source);
}

function isRouteFile(filePath: string): boolean {
  const normalized = relative(repoRoot(), filePath).split(sep).join('/');
  return /\/routes(?:\/|\.ts$)/.test(normalized);
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot(), relativePath), 'utf8');
}

function repoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'pnpm-workspace.yaml'))) return cwd;
  if (cwd.split(sep).slice(-2).join('/') === 'packages/db') return resolve(cwd, '../..');
  return resolve(cwd, '..');
}
