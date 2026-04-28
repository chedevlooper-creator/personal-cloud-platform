import { describe, expect, it, beforeEach, vi } from 'vitest';
import { WorkspaceObjectStorage, WorkspaceService } from './service';
import pino from 'pino';

const { mockDb, insertedValues } = vi.hoisted(() => {
  const now = new Date('2026-04-26T12:00:00.000Z');
  const insertedValues: any[] = [];

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
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
          execute: vi.fn(async () => undefined),
        })),
      })),
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

  return { mockDb, insertedValues };
});

vi.mock('@pcp/db/src/client', () => ({
  db: mockDb,
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
  });
});
