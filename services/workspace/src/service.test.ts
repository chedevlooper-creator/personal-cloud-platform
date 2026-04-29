import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { WorkspaceObjectStorage, WorkspaceService } from './service';
import pino from 'pino';

const { mockDb, insertedValues, updateCalls } = vi.hoisted(() => {
  const now = new Date('2026-04-26T12:00:00.000Z');
  const insertedValues: any[] = [];
  const updateCalls: Array<{ table: unknown; set: any; where?: unknown }> = [];

  const makeWorkspace = (value: any) => ({
    id: 'workspace-1',
    storageUsed: 0,
    storageLimit: 10 * 1024 * 1024,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...value,
  });

  const makeFile = (value: any) => ({
    id: `file-${insertedValues.length}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...value,
  });

  const mockDb = {
    insert: vi.fn(() => ({
      values: vi.fn((value: any) => {
        insertedValues.push(value);
        return {
          returning: vi.fn(async () =>
            'workspaceId' in value ? [makeFile(value)] : [makeWorkspace(value)],
          ),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((value: any) => {
        const call: { table: unknown; set: any; where?: unknown } = { table, set: value };
        updateCalls.push(call);
        return {
          where: vi.fn((predicate: unknown) => {
            call.where = predicate;
            return {
              returning: vi.fn(async () => ('size' in value && 'storageKey' in value ? [makeFile(value)] : [])),
              execute: vi.fn(async () => undefined),
            };
          }),
        };
      }),
    })),
    query: {
      workspaces: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workspaceFiles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      snapshots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };

  return { mockDb, insertedValues, updateCalls };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  desc: (column: unknown) => ({ type: 'desc', column }),
  eq: (column: unknown, value: unknown) => ({ type: 'eq', column, value }),
  isNull: (column: unknown) => ({ type: 'isNull', column }),
}));

class MemoryStorage implements WorkspaceObjectStorage {
  readonly objects = new Map<string, string>();

  async putText(key: string, content: string, _contentType = 'text/plain'): Promise<void> {
    this.objects.set(key, content);
  }

  async putStream(
    key: string,
    stream: NodeJS.ReadableStream,
    _contentType = 'text/plain',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => {
        this.objects.set(key, Buffer.concat(chunks).toString('utf8'));
        resolve();
      });
    });
  }

  async getText(key: string): Promise<string> {
    const content = this.objects.get(key);
    if (content === undefined) throw new Error(`Missing object: ${key}`);
    return content;
  }

  async putBuffer(
    key: string,
    buffer: Buffer,
    _contentType = 'application/octet-stream',
  ): Promise<void> {
    this.objects.set(key, buffer.toString('binary'));
  }

  async getBuffer(key: string): Promise<Buffer> {
    const content = this.objects.get(key);
    if (content === undefined) throw new Error(`Missing object: ${key}`);
    return Buffer.from(content, 'binary');
  }
}

describe('WorkspaceService', () => {
  const logger = pino({ level: 'silent' });
  const now = new Date('2026-04-26T12:00:00.000Z');
  const workspace = {
    id: 'workspace-1',
    userId: 'user-1',
    name: 'Test Workspace',
    storageUsed: 0,
    storageLimit: 10 * 1024 * 1024,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    insertedValues.length = 0;
    updateCalls.length = 0;
    mockDb.query.workspaces.findFirst.mockResolvedValue(workspace);
  });

  it('creates a workspace with starter files', async () => {
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);

    const created = await workspaceService.createWorkspace('user-1', 'Test Workspace');

    expect(created.name).toBe('Test Workspace');
    expect(insertedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'README.md', path: '/README.md', isDirectory: '0' }),
        expect.objectContaining({ name: 'src', path: '/src', isDirectory: '1' }),
        expect.objectContaining({
          name: 'app.ts',
          path: '/src/app.ts',
          parentPath: '/src',
          isDirectory: '0',
        }),
      ]),
    );
    await expect(storage.getText('user-1/workspace-1/README.md')).resolves.toContain(
      'New Workspace',
    );
  });

  it('lists files with numeric sizes', async () => {
    const workspaceService = new WorkspaceService(logger, new MemoryStorage());
    mockDb.query.workspaceFiles.findMany.mockResolvedValue([
      {
        id: 'file-1',
        workspaceId: 'workspace-1',
        path: '/README.md',
        name: 'README.md',
        mimeType: 'text/markdown',
        size: '42',
        storageKey: 'user-1/workspace-1/README.md',
        isDirectory: '0',
        parentPath: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const files = await workspaceService.listFiles('workspace-1', 'user-1', '/');

    expect(files).toHaveLength(1);
    expect(files[0].size).toBe(42);
    expect(files[0].isDirectory).toBe(false);
  });

  it('derives object storage keys from the authenticated tenant and workspace', async () => {
    const workspaceService = new WorkspaceService(logger, new MemoryStorage());

    await workspaceService.createFile('workspace-1', 'user-1', {
      path: '/notes.txt',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 0,
      storageKey: 'user-2/workspace-9/secret.txt',
      isDirectory: false,
    });

    expect(insertedValues).toContainEqual(
      expect.objectContaining({
        path: '/notes.txt',
        storageKey: 'user-1/workspace-1/notes.txt',
      }),
    );
    expect(insertedValues).not.toContainEqual(
      expect.objectContaining({ storageKey: 'user-2/workspace-9/secret.txt' }),
    );
  });

  it('rejects traversal paths before touching storage or file metadata', async () => {
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);

    await expect(
      workspaceService.writeTextFile('workspace-1', 'user-1', '../secret.txt', 'leak'),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(storage.objects.size).toBe(0);
    expect(mockDb.query.workspaceFiles.findFirst).not.toHaveBeenCalled();
  });

  it('scopes workspace metadata updates by workspace id and authenticated user', async () => {
    const { workspaces } = await import('@pcp/db/src/schema');
    const workspaceService = new WorkspaceService(logger, new MemoryStorage());
    mockDb.query.workspaceFiles.findFirst.mockResolvedValue(null);

    await workspaceService.writeTextFile('workspace-1', 'user-1', '/notes.txt', 'tenant scoped');

    const metadataUpdate = updateCalls.find(
      (call) => call.table === workspaces && 'storageUsed' in call.set,
    );
    expect(metadataUpdate).toBeDefined();
    expect(predicateContainsEq(metadataUpdate?.where, workspaces.id, 'workspace-1')).toBe(true);
    expect(predicateContainsEq(metadataUpdate?.where, workspaces.userId, 'user-1')).toBe(true);
  });

  it('previews text files and rejects directories or binary files', async () => {
    const storage = new MemoryStorage();
    await storage.putText('user-1/workspace-1/README.md', '# Preview');
    const workspaceService = new WorkspaceService(logger, storage);

    mockDb.query.workspaceFiles.findFirst.mockResolvedValueOnce({
      id: 'file-1',
      workspaceId: 'workspace-1',
      path: '/README.md',
      name: 'README.md',
      mimeType: 'text/markdown',
      size: '9',
      storageKey: 'user-1/workspace-1/README.md',
      isDirectory: '0',
      parentPath: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await expect(
      workspaceService.getFileContent('workspace-1', 'user-1', '/README.md'),
    ).resolves.toMatchObject({
      content: '# Preview',
      size: 9,
    });

    mockDb.query.workspaceFiles.findFirst.mockResolvedValueOnce({
      id: 'file-2',
      workspaceId: 'workspace-1',
      path: '/src',
      name: 'src',
      mimeType: null,
      size: '0',
      storageKey: '',
      isDirectory: '1',
      parentPath: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await expect(
      workspaceService.getFileContent('workspace-1', 'user-1', '/src'),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    mockDb.query.workspaceFiles.findFirst.mockResolvedValueOnce({
      id: 'file-3',
      workspaceId: 'workspace-1',
      path: '/image.png',
      name: 'image.png',
      mimeType: 'image/png',
      size: '20',
      storageKey: 'user-1/workspace-1/image.png',
      isDirectory: '0',
      parentPath: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await expect(
      workspaceService.getFileContent('workspace-1', 'user-1', '/image.png'),
    ).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  it('round-trips a snapshot: create writes a gzipped archive, restore re-inserts files', async () => {
    const { snapshots } = await import('@pcp/db/src/schema');
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);

    // Source workspace: one text file with known content.
    await storage.putText('user-1/workspace-1/README.md', '# original', 'text/markdown');
    mockDb.query.workspaceFiles.findMany.mockResolvedValue([
      {
        id: 'file-1',
        workspaceId: 'workspace-1',
        path: '/README.md',
        name: 'README.md',
        parentPath: null,
        mimeType: 'text/markdown',
        size: '10',
        storageKey: 'user-1/workspace-1/README.md',
        isDirectory: '0',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const snapshot = await workspaceService.createSnapshot('workspace-1', 'user-1', 'baseline');

    expect(snapshot.storageKey).toMatch(/^snapshots\/user-1\/workspace-1\//);
    expect(storage.objects.has(snapshot.storageKey)).toBe(true);

    // Mutate the workspace and pretend the file changed.
    await storage.putText('user-1/workspace-1/README.md', '# mutated', 'text/markdown');

    // Restore: findFirst should return the snapshot we created.
    mockDb.query.snapshots.findFirst.mockResolvedValue({
      ...snapshot,
      status: 'ready',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    insertedValues.length = 0;
    const result = await workspaceService.restoreSnapshot(snapshot.id, 'user-1');

    expect(result.restoredFiles).toBe(1);
    // Auto pre-restore snapshot + restored file row both inserted.
    expect(insertedValues).toContainEqual(
      expect.objectContaining({ kind: 'auto-pre-restore', workspaceId: 'workspace-1' }),
    );
    expect(insertedValues).toContainEqual(
      expect.objectContaining({ path: '/README.md', isDirectory: '0' }),
    );
    await expect(storage.getText('user-1/workspace-1/README.md')).resolves.toBe('# original');

    const snapshotStatusUpdates = updateCalls.filter(
      (call) =>
        call.table === snapshots &&
        ['ready', 'restoring'].includes(call.set.status) &&
        predicateContainsEq(call.where, snapshots.id, snapshot.id),
    );
    expect(snapshotStatusUpdates.length).toBeGreaterThanOrEqual(2);
    expect(
      snapshotStatusUpdates.every((call) =>
        predicateContainsEq(call.where, snapshots.userId, 'user-1'),
      ),
    ).toBe(true);
    expect(
      snapshotStatusUpdates.every((call) =>
        predicateContainsIsNull(call.where, snapshots.deletedAt),
      ),
    ).toBe(true);
  });

  it('scopes snapshot delete updates by snapshot id and authenticated user', async () => {
    const { snapshots } = await import('@pcp/db/src/schema');
    const workspaceService = new WorkspaceService(logger, new MemoryStorage());
    mockDb.query.snapshots.findFirst.mockResolvedValue({
      id: 'snapshot-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      storageKey: 'snapshots/user-1/workspace-1/archive.json.gz',
      status: 'ready',
      deletedAt: null,
    });

    await workspaceService.deleteSnapshot('snapshot-1', 'user-1');

    const deleteUpdate = updateCalls.find(
      (call) => call.table === snapshots && call.set.status === 'deleted',
    );
    expect(deleteUpdate).toBeDefined();
    expect(predicateContainsEq(deleteUpdate?.where, snapshots.id, 'snapshot-1')).toBe(true);
    expect(predicateContainsEq(deleteUpdate?.where, snapshots.userId, 'user-1')).toBe(true);
    expect(predicateContainsIsNull(deleteUpdate?.where, snapshots.deletedAt)).toBe(true);
  });

  it('counts uploaded bytes from any readable stream', async () => {
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);
    mockDb.query.workspaceFiles.findFirst.mockResolvedValue(undefined);

    const payload = 'hello upload';
    const expectedSize = Buffer.byteLength(payload, 'utf8');
    const source = Readable.from([Buffer.from(payload, 'utf8')]);

    const file = await workspaceService.uploadFile(
      'workspace-1',
      'user-1',
      '/upload.txt',
      'upload.txt',
      'text/plain',
      source,
    );

    expect(file.size).toBe(expectedSize.toString());
    expect(insertedValues).toContainEqual(
      expect.objectContaining({
        path: '/upload.txt',
        size: expectedSize.toString(),
        storageKey: 'user-1/workspace-1/upload.txt',
      }),
    );
    await expect(storage.getText('user-1/workspace-1/upload.txt')).resolves.toBe(payload);
  });

  it('rejects uploads that would exceed quota before writing object storage', async () => {
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce({
      ...workspace,
      storageUsed: 9,
      storageLimit: 10,
    });
    mockDb.query.workspaceFiles.findFirst.mockResolvedValue(undefined);

    await expect(
      workspaceService.uploadFile(
        'workspace-1',
        'user-1',
        '/too-large.txt',
        'too-large.txt',
        'text/plain',
        Readable.from(['xx']),
      ),
    ).rejects.toMatchObject({ statusCode: 413 });

    expect(storage.objects.size).toBe(0);
    expect(insertedValues).not.toContainEqual(expect.objectContaining({ path: '/too-large.txt' }));
  });

  it('accounts upload replacements as a storage delta', async () => {
    const { workspaces } = await import('@pcp/db/src/schema');
    const storage = new MemoryStorage();
    const workspaceService = new WorkspaceService(logger, storage);
    mockDb.query.workspaces.findFirst.mockResolvedValueOnce({
      ...workspace,
      storageUsed: 100,
      storageLimit: 110,
    });
    mockDb.query.workspaceFiles.findFirst.mockResolvedValue({
      id: 'file-existing',
      workspaceId: 'workspace-1',
      path: '/upload.txt',
      name: 'upload.txt',
      mimeType: 'text/plain',
      size: '95',
      storageKey: 'user-1/workspace-1/upload.txt',
      isDirectory: '0',
      parentPath: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await workspaceService.uploadFile(
      'workspace-1',
      'user-1',
      '/upload.txt',
      'upload.txt',
      'text/plain',
      Readable.from(['replacement']),
    );

    const metadataUpdate = updateCalls.find(
      (call) => call.table === workspaces && 'storageUsed' in call.set,
    );
    expect(metadataUpdate?.set.storageUsed).toBe(16);
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
