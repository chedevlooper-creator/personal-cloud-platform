import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { db } from '@pcp/db/src/client';
import { sessions, users, workspaceFiles, workspaces } from '@pcp/db/src/schema';
import { and, eq, isNull } from 'drizzle-orm';

const MAX_TEXT_PREVIEW_BYTES = 256 * 1024;

export interface WorkspaceObjectStorage {
  putText(key: string, content: string, contentType: string): Promise<void>;
  putStream(key: string, stream: NodeJS.ReadableStream, contentType: string): Promise<void>;
  getText(key: string): Promise<string>;
}

export class WorkspaceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

class S3WorkspaceObjectStorage implements WorkspaceObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady = false;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'pcp-workspace';
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
      },
    });
  }

  async putText(key: string, content: string, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      })
    );
  }

  async putStream(key: string, stream: NodeJS.ReadableStream, contentType: string): Promise<void> {
    await this.ensureBucket();
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream as any,
        ContentType: contentType,
      },
    });
    await upload.done();
  }

  async getText(key: string): Promise<string> {
    await this.ensureBucket();
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return this.bodyToString(response.Body);
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }

    this.bucketReady = true;
  }

  private async bodyToString(body: unknown): Promise<string> {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');

    const transformToString = (body as { transformToString?: () => Promise<string> }).transformToString;
    if (transformToString) {
      return transformToString.call(body);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

type StarterFile = {
  path: string;
  name: string;
  mimeType: string | null;
  content?: string;
  isDirectory?: boolean;
  parentPath?: string | null;
};

const starterFiles: StarterFile[] = [
  {
    path: '/README.md',
    name: 'README.md',
    mimeType: 'text/markdown',
    content: [
      '# New Workspace',
      '',
      'This workspace is ready for files, terminal sessions, and agent tasks.',
      '',
      '## Next steps',
      '- Add project files from the file explorer.',
      '- Ask the agent to inspect or modify your workspace.',
      '- Publish a site from the Hosting page when your app is ready.',
      '',
    ].join('\n'),
  },
  {
    path: '/src',
    name: 'src',
    mimeType: null,
    isDirectory: true,
  },
  {
    path: '/src/app.ts',
    name: 'app.ts',
    mimeType: 'text/typescript',
    parentPath: '/src',
    content: [
      'export function helloWorkspace() {',
      "  return 'Hello from Personal Cloud Platform';",
      '}',
      '',
      'console.log(helloWorkspace());',
      '',
    ].join('\n'),
  },
];

export class WorkspaceService {
  constructor(
    private logger: any,
    private storage: WorkspaceObjectStorage = new S3WorkspaceObjectStorage()
  ) {}

  /**
   * Validates that user-supplied paths don't contain traversal sequences.
   * Throws WorkspaceError if a traversal attempt is detected.
   */
  private assertSafePath(path: string): void {
    // Normalize and check for traversal
    const normalized = path.replace(/\\/g, '/');
    if (
      normalized.includes('..') ||
      normalized.includes('\0') ||
      normalized.startsWith('~')
    ) {
      throw new WorkspaceError('Path traversal detected — access denied', 403);
    }
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    this.logger.info({ sessionId: sessionId?.substring(0, 8) + '...' }, 'Validating session');
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    return user?.id || null;
  }

  async createWorkspace(userId: string, name: string): Promise<any> {
    const [workspace] = await db
      .insert(workspaces)
      .values({
        userId,
        name,
      })
      .returning();

    if (!workspace) throw new Error('Failed to create workspace');

    await this.seedStarterFiles(workspace.id, userId);
    return workspace;
  }

  async listUserWorkspaces(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const results = await db.query.workspaces.findMany({
      where: and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt)),
      limit,
      offset,
    });

    return results;
  }

  async getWorkspace(workspaceId: string, userId: string): Promise<any> {
    const workspace = await db.query.workspaces.findFirst({
      where: and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)),
    });

    return workspace;
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    await db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
  }

  async listFiles(workspaceId: string, userId: string, path: string = '/'): Promise<any[]> {
    this.assertSafePath(path);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const normalizedPath = this.normalizeFilePath(path);
    const parentPathCondition = normalizedPath === '/' ? null : normalizedPath;

    const files = await db.query.workspaceFiles.findMany({
      where: and(eq(workspaceFiles.workspaceId, workspaceId), isNull(workspaceFiles.deletedAt)),
    });

    return files.filter((file) => file.parentPath === parentPathCondition).map((file) => this.toFileMetadata(file));
  }

  async getFile(workspaceId: string, userId: string, filePath: string): Promise<any> {
    this.assertSafePath(filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const file = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, this.normalizeFilePath(filePath)),
        isNull(workspaceFiles.deletedAt)
      ),
    });

    if (!file) throw new WorkspaceError('File not found', 404);
    return file;
  }

  async getFileContent(workspaceId: string, userId: string, filePath: string) {
    this.assertSafePath(filePath);
    const file = await this.getFile(workspaceId, userId, filePath);
    const metadata = this.toFileMetadata(file);

    if (metadata.isDirectory) {
      throw new WorkspaceError('Directories cannot be previewed as files', 400);
    }

    if (metadata.size > MAX_TEXT_PREVIEW_BYTES) {
      throw new WorkspaceError('File is too large to preview', 413);
    }

    if (!this.isTextFile(metadata.path, metadata.mimeType)) {
      throw new WorkspaceError('Only text files can be previewed', 415);
    }

    if (!file.storageKey) {
      throw new WorkspaceError('File content is not available', 404);
    }

    const content = await this.storage.getText(file.storageKey);

    return {
      ...metadata,
      content,
    };
  }

  async createFile(
    workspaceId: string,
    userId: string,
    data: {
      path: string;
      name: string;
      mimeType?: string;
      size: number;
      storageKey: string;
      isDirectory: boolean;
      parentPath?: string | null;
    }
  ): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    if (workspace.storageUsed + data.size > workspace.storageLimit) {
      throw new WorkspaceError('Storage quota exceeded', 413);
    }

    const [file] = await db
      .insert(workspaceFiles)
      .values({
        workspaceId,
        path: this.normalizeFilePath(data.path),
        name: data.name,
        mimeType: data.mimeType || null,
        size: data.size.toString(),
        storageKey: data.storageKey,
        isDirectory: data.isDirectory ? '1' : '0',
        parentPath: data.parentPath || null,
      })
      .returning();

    if (!file) throw new Error('Failed to create file');

    await db
      .update(workspaces)
      .set({
        storageUsed: workspace.storageUsed + data.size,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));

    return file;
  }

  async uploadFile(
    workspaceId: string,
    userId: string,
    path: string,
    name: string,
    mimeType: string,
    stream: NodeJS.ReadableStream
  ): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const normalizedPath = this.normalizeFilePath(path);
    const storageKey = this.getStorageKey(userId, workspaceId, normalizedPath);

    // Stream directly to S3
    await this.storage.putStream(storageKey, stream, mimeType);

    // Assume S3 upload succeeded. If we needed exact size we'd have to track it during stream.
    // For now, we will update the size if provided via header or leave it 0 (which is a limitation, but acceptable for MVP).
    // In a real app we'd attach an event listener to the stream to count bytes.
    let size = 0;
    if (stream.hasOwnProperty('byteCount')) {
      size = (stream as any).byteCount;
    }

    const parts = normalizedPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.length > 0 ? '/' + parts.join('/') : null;

    // Check if file exists, if so update it, otherwise create
    const existing = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, normalizedPath),
        isNull(workspaceFiles.deletedAt)
      ),
    });

    let file;
    if (existing) {
      const [updated] = await db
        .update(workspaceFiles)
        .set({
          mimeType,
          size: size.toString(),
          storageKey,
          updatedAt: new Date(),
        })
        .where(eq(workspaceFiles.id, existing.id))
        .returning();
      file = updated;
    } else {
      const [inserted] = await db
        .insert(workspaceFiles)
        .values({
          workspaceId,
          path: normalizedPath,
          name,
          mimeType,
          size: size.toString(),
          storageKey,
          isDirectory: '0',
          parentPath,
        })
        .returning();
      file = inserted;
    }

    if (!file) throw new Error('Failed to create/update file record');

    await db
      .update(workspaces)
      .set({
        storageUsed: workspace.storageUsed + size,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));

    return file;
  }

  async createDirectory(
    workspaceId: string,
    userId: string,
    path: string,
    name: string,
    parentPath?: string
  ): Promise<any> {
    return this.createFile(workspaceId, userId, {
      path,
      name,
      size: 0,
      storageKey: '',
      isDirectory: true,
      parentPath,
    });
  }

  async deleteFile(workspaceId: string, userId: string, filePath: string): Promise<void> {
    this.assertSafePath(filePath);
    const file = await this.getFile(workspaceId, userId, filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);

    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    await db
      .update(workspaceFiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(workspaceFiles.workspaceId, workspaceId), eq(workspaceFiles.path, this.normalizeFilePath(filePath))));

    const fileSize = parseInt(file.size || '0', 10);
    await db
      .update(workspaces)
      .set({
        storageUsed: Math.max(0, workspace.storageUsed - fileSize),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));
  }

  async moveFile(workspaceId: string, userId: string, sourcePath: string, destinationPath: string): Promise<any> {
    this.assertSafePath(sourcePath);
    this.assertSafePath(destinationPath);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const file = await this.getFile(workspaceId, userId, sourcePath);

    const normalizedDestination = this.normalizeFilePath(destinationPath);
    const parts = normalizedDestination.split('/').filter(Boolean);
    const newName = parts.pop() || file.name;
    const newParentPath = parts.length > 0 ? '/' + parts.join('/') : '';

    const [updatedFile] = await db
      .update(workspaceFiles)
      .set({
        path: normalizedDestination,
        name: newName,
        parentPath: newParentPath || null,
        updatedAt: new Date(),
      })
      .where(and(eq(workspaceFiles.workspaceId, workspaceId), eq(workspaceFiles.path, this.normalizeFilePath(sourcePath))))
      .returning();

    return updatedFile;
  }

  private async seedStarterFiles(workspaceId: string, userId: string): Promise<void> {
    for (const starterFile of starterFiles) {
      const size = starterFile.content ? Buffer.byteLength(starterFile.content, 'utf8') : 0;
      const storageKey = starterFile.content ? this.getStorageKey(userId, workspaceId, starterFile.path) : '';

      if (starterFile.content) {
        await this.storage.putText(storageKey, starterFile.content, starterFile.mimeType || 'text/plain');
      }

      await this.createFile(workspaceId, userId, {
        path: starterFile.path,
        name: starterFile.name,
        mimeType: starterFile.mimeType || undefined,
        size,
        storageKey,
        isDirectory: Boolean(starterFile.isDirectory),
        parentPath: starterFile.parentPath,
      });
    }
  }

  private normalizeFilePath(filePath: string): string {
    const trimmed = filePath.trim();
    if (!trimmed || trimmed === '/') return '/';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private toFileMetadata(file: any) {
    return {
      ...file,
      isDirectory: file.isDirectory === true || file.isDirectory === '1',
      size: Number(file.size || 0),
    };
  }

  private getStorageKey(userId: string, workspaceId: string, filePath: string): string {
    return `${userId}/${workspaceId}${this.normalizeFilePath(filePath)}`;
  }

  private isTextFile(path: string, mimeType: string | null): boolean {
    if (mimeType?.startsWith('text/')) return true;
    if (
      mimeType &&
      ['application/json', 'application/javascript', 'application/typescript', 'application/xml', 'application/yaml'].includes(
        mimeType
      )
    ) {
      return true;
    }

    return /\.(cjs|css|csv|env|html|js|json|jsx|md|mdx|mjs|ts|tsx|txt|xml|yaml|yml)$/i.test(path);
  }
  async createSnapshot(workspaceId: string, userId: string, name: string, description?: string): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const { snapshots } = await import('@pcp/db/src/schema');
    const [snapshot] = await db.insert(snapshots).values({
      userId,
      workspaceId,
      name,
      description,
      storageKey: `snapshots/${workspaceId}/${Date.now()}.tar.gz`,
      status: 'ready', // Simplification: we mark it ready immediately without actual tar logic for MVP
    }).returning();

    return snapshot;
  }

  async getSnapshots(workspaceId: string, userId: string): Promise<any[]> {
    const { snapshots } = await import('@pcp/db/src/schema');
    const { desc } = await import('drizzle-orm');
    return db.query.snapshots.findMany({
      where: and(eq(snapshots.workspaceId, workspaceId), eq(snapshots.userId, userId), isNull(snapshots.deletedAt)),
      orderBy: [desc(snapshots.createdAt)]
    });
  }

  async restoreSnapshot(snapshotId: string, userId: string): Promise<void> {
    const { snapshots } = await import('@pcp/db/src/schema');
    const snapshot = await db.query.snapshots.findFirst({
      where: and(eq(snapshots.id, snapshotId), eq(snapshots.userId, userId))
    });
    if (!snapshot) throw new WorkspaceError('Snapshot not found', 404);
    
    // Simplification for MVP: We just log the restore since full tar.gz restore requires streams.
    this.logger.info({ snapshotId }, 'Snapshot restore triggered (Mocked for MVP)');
  }
}
