import { describe, expect, it, vi } from 'vitest';

vi.mock('@pcp/db/src/client', () => ({ db: {} }));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  isNull: (...a: unknown[]) => a,
  asc: (...a: unknown[]) => a,
}));

describe('DatasetsService.assertReadOnly (via query path)', () => {
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
      'COPY foo TO \'/tmp/x\'',
      'PRAGMA threads=4',
      'ATTACH \'other.db\'',
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
});
