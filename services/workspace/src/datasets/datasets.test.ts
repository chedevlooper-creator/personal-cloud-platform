import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, duckRun } = vi.hoisted(() => {
  const duckRun = vi.fn(async () => undefined);
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
  };
  return { mockDb, duckRun };
});

vi.mock('@pcp/db/src/client', () => ({ db: mockDb }));
vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
  asc: (column: unknown) => ({ type: 'asc', column }),
}));
vi.mock('./driver', () => ({
  sanitizeTableName: (input: string) => {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100);
    if (!base) return `t_${Date.now()}`;
    return /^[a-z]/.test(base) ? base : `t_${base}`;
  },
  DuckDb: class {
    async connect() {
      return {
        run: duckRun,
        close: vi.fn(async () => undefined),
      };
    }
  },
}));

describe('DatasetsService.assertReadOnly (via query path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects mutating SQL', async () => {
    const { DatasetsService } = await import('./service');
    const svc = new DatasetsService();
    const banned = [
      'INSERT INTO foo VALUES (1)',
      'UPDATE foo SET x=1',
      'DELETE FROM foo',
      'DROP TABLE foo',
      'ALTER TABLE foo ADD COLUMN x INT',
      'CREATE TABLE foo(x INT)',
      "COPY foo TO '/tmp/x'",
      'PRAGMA threads=4',
      "ATTACH 'other.db'",
    ];
    for (const sql of banned) {
      await expect(svc.query({ userId: 'u', sql })).rejects.toThrow();
    }
  });

  it('rejects multiple statements', async () => {
    const { DatasetsService } = await import('./service');
    const svc = new DatasetsService();
    await expect(svc.query({ userId: 'u', sql: 'SELECT 1; SELECT 2' })).rejects.toThrow(
      /Multiple statements/i,
    );
  });

  it('sanitizes table names', async () => {
    const { sanitizeTableName } = await import('./driver');
    expect(sanitizeTableName('Hello World!')).toBe('hello_world');
    expect(sanitizeTableName('123-numbers')).toBe('t_123_numbers');
    expect(sanitizeTableName('   ')).toMatch(/^t_/);
  });

  it('scopes soft delete by dataset id and authenticated user', async () => {
    const { DatasetsService } = await import('./service');
    const { datasets } = await import('@pcp/db/src/schema');

    let updateWhere: unknown;
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: 'dataset-1',
              userId: 'user-1',
              tableName: 'table_1',
              deletedAt: null,
            },
          ]),
        })),
      })),
    });
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn((predicate: unknown) => {
          updateWhere = predicate;
        }),
      })),
    });

    const svc = new DatasetsService();
    await expect(svc.remove('user-1', 'dataset-1')).resolves.toEqual({ success: true });

    expect(duckRun).toHaveBeenCalledWith('DROP TABLE IF EXISTS "table_1"');
    expect(predicateContainsEq(updateWhere, datasets.id, 'dataset-1')).toBe(true);
    expect(predicateContainsEq(updateWhere, datasets.userId, 'user-1')).toBe(true);
    expect(predicateContainsIsNull(updateWhere, datasets.deletedAt)).toBe(true);
  });
});

function predicateContainsEq(predicate: unknown, column: unknown, value: unknown): boolean {
  if (!predicate || typeof predicate !== 'object') return false;
  const node = predicate as {
    type?: string;
    column?: unknown;
    value?: unknown;
    conditions?: unknown[];
  };
  if (node.type === 'eq') return node.column === column && node.value === value;
  return node.conditions?.some((child) => predicateContainsEq(child, column, value)) ?? false;
}

function predicateContainsIsNull(predicate: unknown, column: unknown): boolean {
  if (!predicate || typeof predicate !== 'object') return false;
  const node = predicate as { type?: string; column?: unknown; conditions?: unknown[] };
  if (node.type === 'isNull') return node.column === column;
  return node.conditions?.some((child) => predicateContainsIsNull(child, column)) ?? false;
}
