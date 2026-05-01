import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from './env';
import { WorkspaceClient, type SyncManifestEntry } from './workspace-client';

export class WorkspaceMaterializationError extends Error {
  constructor(message: string) {
    super(`Workspace materialization failed: ${message}`);
    this.name = 'WorkspaceMaterializationError';
  }
}

export class WorkspaceMaterializer {
  private readonly root: string;

  constructor(
    private readonly client = new WorkspaceClient(),
    root = env.PUBLISH_WORKSPACE_HOST_ROOT,
  ) {
    this.root = resolve(root);
  }

  async materialize(userId: string, workspaceId: string): Promise<string> {
    const manifest = await this.client.getSyncManifest(userId, workspaceId);
    const targetRoot = this.resolveTenantRoot(userId, workspaceId);
    const stagingRoot = `${targetRoot}.tmp-${process.pid}-${Date.now()}`;

    try {
      await rm(stagingRoot, { recursive: true, force: true });
      await mkdir(stagingRoot, { recursive: true });

      for (const entry of manifest.files) {
        await this.writeEntry(stagingRoot, entry);
      }

      await rm(targetRoot, { recursive: true, force: true });
      await mkdir(dirname(targetRoot), { recursive: true });
      await rename(stagingRoot, targetRoot);
      return targetRoot;
    } catch (error) {
      await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
      if (error instanceof WorkspaceMaterializationError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceMaterializationError(message);
    }
  }

  private resolveTenantRoot(userId: string, workspaceId: string): string {
    const target = resolve(this.root, userId, workspaceId);
    this.assertInsideRoot(target, this.root, 'tenant workspace root');
    return target;
  }

  private async writeEntry(stagingRoot: string, entry: SyncManifestEntry): Promise<void> {
    const relativePath = normalizeManifestPath(entry.path);
    if (!relativePath) {
      if (entry.isDirectory) return;
      throw new WorkspaceMaterializationError('manifest contains an empty file path');
    }

    const target = resolve(stagingRoot, relativePath);
    this.assertInsideRoot(target, stagingRoot, entry.path);

    if (entry.isDirectory) {
      await mkdir(target, { recursive: true });
      return;
    }

    if (entry.contentBase64 == null) {
      throw new WorkspaceMaterializationError(`missing content for ${entry.path}`);
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(entry.contentBase64, 'base64'));
  }

  private assertInsideRoot(path: string, root: string, label: string): void {
    if (path !== root && !path.startsWith(root + sep)) {
      throw new WorkspaceMaterializationError(`unsafe path outside workspace root: ${label}`);
    }
  }
}

function normalizeManifestPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    normalized.includes('\0') ||
    normalized.split('/').some((segment) => segment === '..') ||
    normalized.startsWith('~')
  ) {
    throw new WorkspaceMaterializationError(`unsafe path: ${path}`);
  }
  return normalized;
}
