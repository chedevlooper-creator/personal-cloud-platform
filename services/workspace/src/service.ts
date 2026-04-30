import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { db } from '@pcp/db/src/client';
import { snapshots, workspaceFiles, workspaces } from '@pcp/db/src/schema';
import {
  validateSessionUserId,
  verifyUserExists as verifySharedUserExists,
} from '@pcp/db/src/session';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { gunzipSync, gzipSync } from 'node:zlib';
import { env } from './env';

const MAX_TEXT_PREVIEW_BYTES = 256 * 1024;
const SNAPSHOT_FORMAT_VERSION = 1;

export interface WorkspaceObjectStorage {
  putText(key: string, content: string, contentType: string): Promise<void>;
  putStream(key: string, stream: NodeJS.ReadableStream, contentType: string): Promise<void>;
  putBuffer(key: string, buffer: Buffer, contentType: string): Promise<void>;
  getText(key: string): Promise<string>;
  getBuffer(key: string): Promise<Buffer>;
  /**
   * Best-effort delete. Used as a compensating action when a DB write fails
   * after a successful S3 put, to avoid orphaned tenant objects.
   */
  deleteObject(key: string): Promise<void>;
}

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

class S3WorkspaceObjectStorage implements WorkspaceObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady = false;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
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
      }),
    );
  }

  async putStream(key: string, stream: NodeJS.ReadableStream, contentType: string): Promise<void> {
    await this.ensureBucket();
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream as Readable,
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
      }),
    );

    return this.bodyToString(response.Body);
  }

  async putBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    await this.ensureBucket();
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return this.bodyToBuffer(response.Body);
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async bodyToBuffer(body: unknown): Promise<Buffer> {
    if (!body) return Buffer.alloc(0);
    if (body instanceof Uint8Array) return Buffer.from(body);
    const transformToByteArray = (body as { transformToByteArray?: () => Promise<Uint8Array> })
      .transformToByteArray;
    if (transformToByteArray) {
      return Buffer.from(await transformToByteArray.call(body));
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
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

    const transformToString = (body as { transformToString?: () => Promise<string> })
      .transformToString;
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
    private storage: WorkspaceObjectStorage = new S3WorkspaceObjectStorage(),
  ) {}

  /**
   * Validates that user-supplied paths don't contain traversal sequences.
   * Throws WorkspaceError if a traversal attempt is detected.
   */
  private assertSafePath(path: string): void {
    // Normalize and check for traversal
    const normalized = path.replace(/\\/g, '/');
    if (normalized.includes('..') || normalized.includes('\0') || normalized.startsWith('~')) {
      throw new WorkspaceError('Path traversal detected — access denied', 403);
    }
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    this.logger.info('Validating session');
    return validateSessionUserId(sessionId);
  }

  /**
   * Confirm that a user id received via internal Bearer + x-user-id header maps
   * to a real account. Returns the userId on success, null otherwise.
   */
  async verifyUserExists(userId: string): Promise<string | null> {
    if (!userId) return null;
    return verifySharedUserExists(userId);
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

    let results = await db.query.workspaces.findMany({
      where: and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt)),
      limit,
      offset,
    });

    // Auto-provision a default workspace on first access so newly registered
    // users can immediately use chat / files without a manual setup step.
    if (page === 1 && results.length === 0) {
      try {
        await this.createWorkspace(userId, 'Personal workspace');
      } catch (err) {
        // Race-safe: if another request created it concurrently, just refetch.
      }
      results = await db.query.workspaces.findMany({
        where: and(eq(workspaces.userId, userId), isNull(workspaces.deletedAt)),
        limit,
        offset,
      });
    }

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

    return files
      .filter((file) => file.parentPath === parentPathCondition)
      .map((file) => this.toFileMetadata(file));
  }

  async getFile(workspaceId: string, userId: string, filePath: string): Promise<any> {
    this.assertSafePath(filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const file = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, this.normalizeFilePath(filePath)),
        isNull(workspaceFiles.deletedAt),
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
      storageKey?: string;
      isDirectory: boolean;
      parentPath?: string | null;
    },
  ): Promise<any> {
    this.assertSafePath(data.path);
    if (data.parentPath) this.assertSafePath(data.parentPath);

    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    if (workspace.storageUsed + data.size > workspace.storageLimit) {
      throw new WorkspaceError('Storage quota exceeded', 413);
    }

    const normalizedPath = this.normalizeFilePath(data.path);
    const storageKey = data.isDirectory
      ? ''
      : this.getStorageKey(userId, workspaceId, normalizedPath);

    const [file] = await db
      .insert(workspaceFiles)
      .values({
        workspaceId,
        path: normalizedPath,
        name: data.name,
        mimeType: data.mimeType || null,
        size: data.size.toString(),
        storageKey,
        isDirectory: data.isDirectory ? '1' : '0',
        parentPath: data.parentPath ? this.normalizeFilePath(data.parentPath) : null,
      })
      .returning();

    if (!file) throw new Error('Failed to create file');

    await db
      .update(workspaces)
      .set({
        storageUsed: workspace.storageUsed + data.size,
        updatedAt: new Date(),
      })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));

    return file;
  }

  async uploadFile(
    workspaceId: string,
    userId: string,
    path: string,
    name: string,
    mimeType: string,
    stream: NodeJS.ReadableStream,
  ): Promise<any> {
    this.assertSafePath(path);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const normalizedPath = this.normalizeFilePath(path);
    const storageKey = this.getStorageKey(userId, workspaceId, normalizedPath);

    const parts = normalizedPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.length > 0 ? '/' + parts.join('/') : null;

    // Check if file exists, if so update it, otherwise create
    const existing = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, normalizedPath),
        isNull(workspaceFiles.deletedAt),
      ),
    });

    const previousSize = existing ? Number(existing.size || 0) : 0;
    const maxBytes = Math.max(0, workspace.storageLimit - workspace.storageUsed + previousSize);
    const upload = this.createQuotaLimitedStream(stream, maxBytes);

    await this.storage.putStream(storageKey, upload.stream, mimeType);
    const size = upload.getSize();

    let file;
    try {
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
          storageUsed: Math.max(0, workspace.storageUsed - previousSize + size),
          updatedAt: new Date(),
        })
        .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
    } catch (err) {
      // S3 already received the new bytes. For NEW files (no `existing` row)
      // delete the just-written object to avoid an orphan that leaks tenant
      // storage and bypasses quota tracking. For overwrites of existing files
      // we cannot restore previous content; leave as-is and surface the error.
      if (!existing) {
        await this.storage.deleteObject(storageKey).catch((cleanupErr) => {
          this.logger.error(
            { err: cleanupErr, storageKey, workspaceId, userId },
            'Failed to delete orphaned S3 object after DB write failure',
          );
        });
      }
      throw err;
    }

    return file;
  }

  private createQuotaLimitedStream(
    stream: NodeJS.ReadableStream,
    maxBytes: number,
  ): { stream: NodeJS.ReadableStream; getSize: () => number } {
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer | string, _encoding, callback) {
        const bytes = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
        size += bytes;
        if (size > maxBytes) {
          callback(new WorkspaceError('Storage quota exceeded', 413));
          return;
        }
        callback(null, chunk);
      },
    });

    return { stream: stream.pipe(counter), getSize: () => size };
  }

  async createDirectory(
    workspaceId: string,
    userId: string,
    path: string,
    name: string,
    parentPath?: string,
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

  /**
   * Atomically write a text file. Creates or updates the metadata row and writes content to S3.
   * Used by the agent's `write_file` tool.
   */
  async writeTextFile(
    workspaceId: string,
    userId: string,
    filePath: string,
    content: string,
    mimeType: string = 'text/plain',
  ): Promise<{ bytesWritten: number; path: string }> {
    this.assertSafePath(filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const normalizedPath = this.normalizeFilePath(filePath);
    const size = Buffer.byteLength(content, 'utf8');
    const storageKey = this.getStorageKey(userId, workspaceId, normalizedPath);

    const existing = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, normalizedPath),
        isNull(workspaceFiles.deletedAt),
      ),
    });

    const previousSize = existing ? Number(existing.size || 0) : 0;
    const projectedUsage = workspace.storageUsed - previousSize + size;
    if (projectedUsage > workspace.storageLimit) {
      throw new WorkspaceError('Storage quota exceeded', 413);
    }

    await this.storage.putText(storageKey, content, mimeType);

    const parts = normalizedPath.split('/').filter(Boolean);
    const fileName = parts.pop() ?? '';
    const parentPath = parts.length > 0 ? '/' + parts.join('/') : null;

    try {
      if (existing) {
        await db
          .update(workspaceFiles)
          .set({
            mimeType,
            size: size.toString(),
            storageKey,
            updatedAt: new Date(),
          })
          .where(eq(workspaceFiles.id, existing.id));
      } else {
        await db.insert(workspaceFiles).values({
          workspaceId,
          path: normalizedPath,
          name: fileName,
          mimeType,
          size: size.toString(),
          storageKey,
          isDirectory: '0',
          parentPath,
        });
      }

      await db
        .update(workspaces)
        .set({
          storageUsed: Math.max(0, workspace.storageUsed - previousSize + size),
          updatedAt: new Date(),
        })
        .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
    } catch (err) {
      if (!existing) {
        await this.storage.deleteObject(storageKey).catch((cleanupErr) => {
          this.logger.error(
            { err: cleanupErr, storageKey, workspaceId, userId },
            'Failed to delete orphaned S3 object after DB write failure',
          );
        });
      }
      throw err;
    }

    return { bytesWritten: size, path: normalizedPath };
  }

  /**
   * Build a sync manifest of all non-deleted files in a workspace, with inline content
   * for non-directory files under `maxInlineBytes`. Used by the runtime service to
   * materialize the workspace tree onto a Docker host directory before exec.
   */
  async buildSyncManifest(
    workspaceId: string,
    userId: string,
    opts: { maxInlineBytes?: number } = {},
  ): Promise<{
    files: Array<{
      path: string;
      isDirectory: boolean;
      size: number;
      mimeType: string | null;
      contentBase64: string | null;
    }>;
  }> {
    const maxInlineBytes = opts.maxInlineBytes ?? 1_048_576; // 1 MiB
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const rows = await db.query.workspaceFiles.findMany({
      where: and(eq(workspaceFiles.workspaceId, workspaceId), isNull(workspaceFiles.deletedAt)),
    });

    const files: Array<{
      path: string;
      isDirectory: boolean;
      size: number;
      mimeType: string | null;
      contentBase64: string | null;
    }> = [];

    for (const row of rows) {
      const isDirectory = row.isDirectory === '1';
      const size = Number(row.size || 0);
      let contentBase64: string | null = null;

      if (!isDirectory && row.storageKey && size <= maxInlineBytes) {
        try {
          const text = await this.storage.getText(row.storageKey);
          contentBase64 = Buffer.from(text, 'utf8').toString('base64');
        } catch {
          contentBase64 = null;
        }
      }

      files.push({
        path: row.path,
        isDirectory,
        size,
        mimeType: row.mimeType ?? null,
        contentBase64,
      });
    }

    return { files };
  }

  async deleteFile(workspaceId: string, userId: string, filePath: string): Promise<void> {
    this.assertSafePath(filePath);
    const file = await this.getFile(workspaceId, userId, filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);

    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    await db
      .update(workspaceFiles)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(workspaceFiles.workspaceId, workspaceId),
          eq(workspaceFiles.path, this.normalizeFilePath(filePath)),
        ),
      );

    const fileSize = parseInt(file.size || '0', 10);
    await db
      .update(workspaces)
      .set({
        storageUsed: Math.max(0, workspace.storageUsed - fileSize),
        updatedAt: new Date(),
      })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
  }

  async moveFile(
    workspaceId: string,
    userId: string,
    sourcePath: string,
    destinationPath: string,
  ): Promise<any> {
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
      .where(
        and(
          eq(workspaceFiles.workspaceId, workspaceId),
          eq(workspaceFiles.path, this.normalizeFilePath(sourcePath)),
        ),
      )
      .returning();

    return updatedFile;
  }

  private async seedStarterFiles(workspaceId: string, userId: string): Promise<void> {
    for (const starterFile of starterFiles) {
      const size = starterFile.content ? Buffer.byteLength(starterFile.content, 'utf8') : 0;
      const storageKey = starterFile.content
        ? this.getStorageKey(userId, workspaceId, starterFile.path)
        : '';

      if (starterFile.content) {
        await this.storage.putText(
          storageKey,
          starterFile.content,
          starterFile.mimeType || 'text/plain',
        );
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
      [
        'application/json',
        'application/javascript',
        'application/typescript',
        'application/xml',
        'application/yaml',
      ].includes(mimeType)
    ) {
      return true;
    }

    return /\.(cjs|css|csv|env|html|js|json|jsx|md|mdx|mjs|ts|tsx|txt|xml|yaml|yml)$/i.test(path);
  }
  async createSnapshot(
    workspaceId: string,
    userId: string,
    name: string,
    description?: string,
    kind: 'manual' | 'auto-pre-restore' = 'manual',
  ): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new WorkspaceError('Workspace not found', 404);

    const storageKey = `snapshots/${userId}/${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json.gz`;

    const [snapshot] = await db
      .insert(snapshots)
      .values({
        userId,
        workspaceId,
        name,
        description,
        storageKey,
        kind,
        status: 'creating',
      })
      .returning();

    if (!snapshot) throw new WorkspaceError('Failed to create snapshot record', 500);

    try {
      const archive = await this.buildSnapshotArchive(workspaceId);
      const buffer = gzipSync(Buffer.from(JSON.stringify(archive), 'utf8'));
      await this.storage.putBuffer(storageKey, buffer, 'application/gzip');

      const [updated] = await db
        .update(snapshots)
        .set({
          status: 'ready',
          sizeBytes: buffer.byteLength.toString(),
          fileCount: archive.files.length,
        })
        .where(
          and(
            eq(snapshots.id, snapshot.id),
            eq(snapshots.userId, userId),
            isNull(snapshots.deletedAt),
          ),
        )
        .returning();

      return updated ?? snapshot;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Snapshot creation failed';
      this.logger.error({ err, snapshotId: snapshot.id }, 'Failed to build snapshot archive');
      await db
        .update(snapshots)
        .set({ status: 'failed', error: message })
        .where(
          and(
            eq(snapshots.id, snapshot.id),
            eq(snapshots.userId, userId),
            isNull(snapshots.deletedAt),
          ),
        );
      throw new WorkspaceError(`Snapshot failed: ${message}`, 500);
    }
  }

  async getSnapshot(snapshotId: string, userId: string) {
    return db.query.snapshots.findFirst({
      where: and(eq(snapshots.id, snapshotId), eq(snapshots.userId, userId), isNull(snapshots.deletedAt)),
    });
  }

  async getSnapshotBuffer(storageKey: string): Promise<Buffer> {
    return this.storage.getBuffer(storageKey);
  }

  async getSnapshots(workspaceId: string, userId: string): Promise<any[]> {
    return db.query.snapshots.findMany({
      where: and(
        eq(snapshots.workspaceId, workspaceId),
        eq(snapshots.userId, userId),
        isNull(snapshots.deletedAt),
      ),
      orderBy: [desc(snapshots.createdAt)],
    });
  }

  async getUserSnapshotStorageUsage(userId: string): Promise<{ totalBytes: number; count: number }> {
    const rows = await db.query.snapshots.findMany({
      where: and(eq(snapshots.userId, userId), isNull(snapshots.deletedAt), eq(snapshots.status, 'ready')),
      columns: { sizeBytes: true },
    });
    const totalBytes = rows.reduce((sum, r) => sum + Number(r.sizeBytes ?? 0), 0);
    return { totalBytes, count: rows.length };
  }

  async deleteSnapshot(snapshotId: string, userId: string): Promise<void> {
    const snapshot = await db.query.snapshots.findFirst({
      where: and(eq(snapshots.id, snapshotId), eq(snapshots.userId, userId)),
    });
    if (!snapshot) throw new WorkspaceError('Snapshot not found', 404);

    await db
      .update(snapshots)
      .set({ deletedAt: new Date(), status: 'deleted' })
      .where(
        and(
          eq(snapshots.id, snapshotId),
          eq(snapshots.userId, userId),
          isNull(snapshots.deletedAt),
        ),
      );
  }

  async restoreSnapshot(snapshotId: string, userId: string): Promise<{ restoredFiles: number }> {
    const snapshot = await db.query.snapshots.findFirst({
      where: and(eq(snapshots.id, snapshotId), eq(snapshots.userId, userId)),
    });
    if (!snapshot) throw new WorkspaceError('Snapshot not found', 404);
    if (snapshot.status !== 'ready') {
      throw new WorkspaceError(`Snapshot not restorable (status=${snapshot.status})`, 400);
    }

    // Auto pre-restore snapshot so the user can roll back the rollback.
    try {
      await this.createSnapshot(
        snapshot.workspaceId,
        userId,
        `pre-restore ${new Date().toISOString()}`,
        `Automatic snapshot taken before restoring ${snapshot.name}`,
        'auto-pre-restore',
      );
    } catch (err) {
      this.logger.warn({ err, snapshotId }, 'Auto pre-restore snapshot failed; aborting restore');
      throw new WorkspaceError('Failed to create pre-restore snapshot', 500);
    }

    await db
      .update(snapshots)
      .set({ status: 'restoring' })
      .where(
        and(
          eq(snapshots.id, snapshotId),
          eq(snapshots.userId, userId),
          isNull(snapshots.deletedAt),
        ),
      );

    try {
      const buffer = await this.storage.getBuffer(snapshot.storageKey);
      const json = gunzipSync(buffer).toString('utf8');
      const archive = JSON.parse(json) as SnapshotArchive;

      if (archive.version !== SNAPSHOT_FORMAT_VERSION) {
        throw new Error(`Unsupported snapshot format version ${archive.version}`);
      }

      const restoredCount = await this.applySnapshotArchive(snapshot.workspaceId, userId, archive);

      await db
        .update(snapshots)
        .set({ status: 'ready' })
        .where(
          and(
            eq(snapshots.id, snapshotId),
            eq(snapshots.userId, userId),
            isNull(snapshots.deletedAt),
          ),
        );

      return { restoredFiles: restoredCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed';
      this.logger.error({ err, snapshotId }, 'Failed to restore snapshot');
      await db
        .update(snapshots)
        .set({ status: 'failed', error: message })
        .where(
          and(
            eq(snapshots.id, snapshotId),
            eq(snapshots.userId, userId),
            isNull(snapshots.deletedAt),
          ),
        );
      throw new WorkspaceError(`Restore failed: ${message}`, 500);
    }
  }

  private async buildSnapshotArchive(workspaceId: string): Promise<SnapshotArchive> {
    const rows = await db.query.workspaceFiles.findMany({
      where: and(eq(workspaceFiles.workspaceId, workspaceId), isNull(workspaceFiles.deletedAt)),
    });

    const files: SnapshotArchive['files'] = [];
    for (const row of rows) {
      const isDirectory = row.isDirectory === '1';
      let contentBase64: string | null = null;

      if (!isDirectory && row.storageKey) {
        try {
          const text = await this.storage.getText(row.storageKey);
          contentBase64 = Buffer.from(text, 'utf8').toString('base64');
        } catch (err) {
          this.logger.warn({ err, path: row.path }, 'Failed to read file during snapshot');
          contentBase64 = '';
        }
      }

      files.push({
        path: row.path,
        name: row.name,
        parentPath: row.parentPath,
        isDirectory,
        mimeType: row.mimeType,
        size: Number(row.size || 0),
        contentBase64,
      });
    }

    return {
      version: SNAPSHOT_FORMAT_VERSION,
      workspaceId,
      createdAt: new Date().toISOString(),
      files,
    };
  }

  private async applySnapshotArchive(
    workspaceId: string,
    userId: string,
    archive: SnapshotArchive,
  ): Promise<number> {
    // Soft-delete current files so existing storageKeys remain readable for any
    // in-flight requests; the new snapshot uses fresh keys.
    await db
      .update(workspaceFiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(workspaceFiles.workspaceId, workspaceId), isNull(workspaceFiles.deletedAt)));

    let totalSize = 0;
    let restored = 0;

    for (const entry of archive.files) {
      const normalizedPath = this.normalizeFilePath(entry.path);
      let storageKey = '';

      if (!entry.isDirectory) {
        storageKey = this.getStorageKey(userId, workspaceId, normalizedPath);
        const text = entry.contentBase64
          ? Buffer.from(entry.contentBase64, 'base64').toString('utf8')
          : '';
        await this.storage.putText(storageKey, text, entry.mimeType ?? 'text/plain');
        totalSize += entry.size;
      }

      await db.insert(workspaceFiles).values({
        workspaceId,
        path: normalizedPath,
        name: entry.name,
        mimeType: entry.mimeType,
        size: entry.size.toString(),
        storageKey,
        isDirectory: entry.isDirectory ? '1' : '0',
        parentPath: entry.parentPath,
      });
      restored += 1;
    }

    await db
      .update(workspaces)
      .set({ storageUsed: totalSize, updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));

    return restored;
  }
}

interface SnapshotArchive {
  version: number;
  workspaceId: string;
  createdAt: string;
  files: Array<{
    path: string;
    name: string;
    parentPath: string | null;
    isDirectory: boolean;
    mimeType: string | null;
    size: number;
    contentBase64: string | null;
  }>;
}
