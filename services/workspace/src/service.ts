import { db } from '@pcp/db/src/client';
import { workspaces, workspaceFiles, users, sessions } from '@pcp/db/src/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class WorkspaceService {
  constructor(private logger: any) {}

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
    const [workspace] = await db.insert(workspaces).values({
      userId,
      name,
    }).returning();

    if (!workspace) throw new Error('Failed to create workspace');
    return workspace;
  }

  async listUserWorkspaces(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const results = await db.query.workspaces.findMany({
      where: and(
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt)
      ),
      limit,
      offset,
    });

    return results;
  }

  async getWorkspace(workspaceId: string, userId: string): Promise<any> {
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId)
      ),
    });

    return workspace;
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    await db.update(workspaces)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId)
      ));
  }

  async listFiles(workspaceId: string, userId: string, path: string = '/'): Promise<any[]> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new Error('Workspace not found');

    const normalizedPath = path === '/' ? '' : path;
    const parentPathCondition = normalizedPath === '' ? null : normalizedPath;
    
    const files = await db.query.workspaceFiles.findMany({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        isNull(workspaceFiles.deletedAt)
      ),
    });

    return files.filter(f => f.parentPath === parentPathCondition).map(f => ({
      ...f,
      isDirectory: f.isDirectory === '1',
      size: parseInt(f.size || '0', 10),
    }));
  }

  async getFile(workspaceId: string, userId: string, filePath: string): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new Error('Workspace not found');

    const file = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, filePath),
        isNull(workspaceFiles.deletedAt)
      ),
    });

    if (!file) throw new Error('File not found');
    return file;
  }

  async createFile(workspaceId: string, userId: string, data: {
    path: string;
    name: string;
    mimeType?: string;
    size: number;
    storageKey: string;
    isDirectory: boolean;
    parentPath?: string;
  }): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new Error('Workspace not found');

    if (workspace.storageUsed + data.size > workspace.storageLimit) {
      throw new Error('Storage quota exceeded');
    }

    const [file] = await db.insert(workspaceFiles).values({
      workspaceId,
      path: data.path,
      name: data.name,
      mimeType: data.mimeType || null,
      size: data.size.toString(),
      storageKey: data.storageKey,
      isDirectory: data.isDirectory ? '1' : '0',
      parentPath: data.parentPath || null,
    }).returning();

    if (!file) throw new Error('Failed to create file');

    await db.update(workspaces)
      .set({ 
        storageUsed: workspace.storageUsed + data.size,
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceId));

    return file;
  }

  async createDirectory(workspaceId: string, userId: string, path: string, name: string, parentPath?: string): Promise<any> {
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
    const file = await this.getFile(workspaceId, userId, filePath);
    const workspace = await this.getWorkspace(workspaceId, userId);
    
    if (!workspace) throw new Error('Workspace not found');

    await db.update(workspaceFiles)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, filePath)
      ));

    const fileSize = parseInt(file.size || '0', 10);
    await db.update(workspaces)
      .set({
        storageUsed: Math.max(0, workspace.storageUsed - fileSize),
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceId));
  }

  async moveFile(workspaceId: string, userId: string, sourcePath: string, destinationPath: string): Promise<any> {
    const workspace = await this.getWorkspace(workspaceId, userId);
    if (!workspace) throw new Error('Workspace not found');

    const file = await this.getFile(workspaceId, userId, sourcePath);

    const parts = destinationPath.split('/').filter(Boolean);
    const newName = parts.pop() || file.name;
    const newParentPath = parts.length > 0 ? '/' + parts.join('/') : '';

    const [updatedFile] = await db.update(workspaceFiles)
      .set({
        path: destinationPath,
        name: newName,
        parentPath: newParentPath || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(workspaceFiles.workspaceId, workspaceId),
        eq(workspaceFiles.path, sourcePath)
      ))
      .returning();

    return updatedFile;
  }
}