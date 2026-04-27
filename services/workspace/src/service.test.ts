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
          returning: vi.fn(async () => ('workspaceId' in value ? [makeFile(value)] : [makeWorkspace(value)])),
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

  async putStream(key: string, stream: NodeJS.ReadableStream, _contentType = 'text/plain'): Promise<void> {
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
        expect.objectContaining({ name: 'app.ts', path: '/src/app.ts', parentPath: '/src', isDirectory: '0' }),
      ])
    );
    await expect(storage.getText('user-1/workspace-1/README.md')).resolves.toContain('New Workspace');
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

    await expect(workspaceService.getFileContent('workspace-1', 'user-1', '/README.md')).resolves.toMatchObject({
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

    await expect(workspaceService.getFileContent('workspace-1', 'user-1', '/src')).rejects.toMatchObject({
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

    await expect(workspaceService.getFileContent('workspace-1', 'user-1', '/image.png')).rejects.toMatchObject({
      statusCode: 415,
    });
  });
});
