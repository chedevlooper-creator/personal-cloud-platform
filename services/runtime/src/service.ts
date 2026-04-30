import { db } from '@pcp/db/src/client';
import { runtimes, runtimeLogs, runtimeEvents, workspaces, auditLogs } from '@pcp/db/src/schema';
import {
  validateSessionUserId,
  verifyUserExists as verifySharedUserExists,
} from '@pcp/db/src/session';
import { eq, and, isNull, desc, ne } from 'drizzle-orm';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { DockerProvider } from './provider/docker';
import { RuntimeProvider } from './provider/types';
import { env } from './env';
import { WorkspaceClient } from './workspaceClient';
import {
  assertRuntimeCommandAllowed,
  assertRuntimeImageAllowed,
  RUNTIME_COMMAND_POLICY,
} from './policy';

const SYNC_IGNORE_DIRS = new Set(['node_modules', '.git', '.cache', 'dist', '.next', '.venv']);
const SYNC_BACK_MAX_BYTES = 512 * 1024;

export class RuntimeService {
  private provider: RuntimeProvider;
  private workspaceClient: WorkspaceClient;

  constructor(private logger: any) {
    this.provider = new DockerProvider();
    this.workspaceClient = new WorkspaceClient();
    this.logger.info('RuntimeService initialized');
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
    return validateSessionUserId(sessionId);
  }

  async verifyUserExists(userId: string): Promise<string | null> {
    if (!userId) return null;
    return verifySharedUserExists(userId);
  }

  private async auditLog(
    userId: string,
    action: string,
    details: Record<string, unknown>,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    try {
      await db.insert(auditLogs).values({
        userId,
        action,
        details,
        ipAddress: clientInfo?.ipAddress ?? null,
        userAgent: clientInfo?.userAgent ?? null,
      });
    } catch (err) {
      this.logger.warn({ err, userId, action }, 'Failed to write audit log');
    }
  }

  private async resolveWorkspaceHostPath(userId: string, workspaceId: string): Promise<string> {
    const root = env.WORKSPACE_HOST_ROOT;
    const dir = join(root, userId, workspaceId);
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      this.logger.warn({ err, dir }, 'Failed to ensure workspace host directory');
    }
    return dir;
  }

  async createRuntime(
    userId: string,
    workspaceId: string,
    image: string,
    options: any,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.assertWorkspaceOwned(workspaceId, userId);
    try {
      assertRuntimeImageAllowed(image);
    } catch (err) {
      await this.auditLog(userId, 'runtime.image_denied', { image, workspaceId, reason: (err as Error).message }, clientInfo);
      throw err;
    }

    const [runtime] = await db
      .insert(runtimes)
      .values({
        userId,
        workspaceId,
        image,
        options,
        status: 'pending',
      })
      .returning();

    if (!runtime) throw new Error('Failed to create runtime record');

    const hostWorkspacePath = await this.resolveWorkspaceHostPath(userId, workspaceId);

    let containerId: string;
    try {
      containerId = await this.provider.create(image, {
        ...options,
        workspacePath: hostWorkspacePath,
        labels: {
          ...(options?.labels ?? {}),
          'pcp.service': 'runtime',
          'pcp.userId': userId,
          'pcp.workspaceId': workspaceId,
          'pcp.runtimeId': runtime.id,
        },
      });
    } catch (err) {
      // Trace 13 (#13m): a Docker provisioning failure used to leave the
      // runtime row pinned at status='pending' forever, requiring manual
      // database cleanup. Mark the row failed and emit an event so listings,
      // health probes, and the operator UI can move on.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        { err, runtimeId: runtime.id, userId, workspaceId, image },
        'Docker provisioning failed; marking runtime failed',
      );
      await db
        .update(runtimes)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(and(eq(runtimes.id, runtime.id), eq(runtimes.userId, userId)));
      await db.insert(runtimeEvents).values({
        runtimeId: runtime.id,
        type: 'failed',
        payload: { stage: 'create', error: message },
      });
      throw err;
    }

    await db
      .update(runtimes)
      .set({ containerId })
      .where(and(eq(runtimes.id, runtime.id), eq(runtimes.userId, userId)));

    await db.insert(runtimeEvents).values({
      runtimeId: runtime.id,
      type: 'create',
      payload: { containerId, options },
    });

    await this.auditLog(userId, 'runtime.create', { runtimeId: runtime.id, workspaceId, image, containerId }, clientInfo);

    return { ...runtime, containerId };
  }

  private async assertWorkspaceOwned(workspaceId: string, userId: string) {
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.userId, userId),
        isNull(workspaces.deletedAt),
      ),
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }
  }

  async startRuntime(runtimeId: string, userId: string) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId) throw new Error('Runtime or container not found');

    await this.provider.start(runtime.containerId);

    await db
      .update(runtimes)
      .set({ status: 'running', lastStartedAt: new Date() })
      .where(and(eq(runtimes.id, runtimeId), eq(runtimes.userId, userId)));

    await db.insert(runtimeEvents).values({
      runtimeId,
      type: 'start',
    });
  }

  async stopRuntime(runtimeId: string, userId: string) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId) throw new Error('Runtime or container not found');

    await this.provider.stop(runtime.containerId);

    await db
      .update(runtimes)
      .set({ status: 'stopped', lastStoppedAt: new Date() })
      .where(and(eq(runtimes.id, runtimeId), eq(runtimes.userId, userId)));

    await db.insert(runtimeEvents).values({
      runtimeId,
      type: 'stop',
    });
  }

  async execCommand(
    runtimeId: string,
    userId: string,
    command: string[],
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId || runtime.status !== 'running') {
      throw new Error('Runtime not running or container not found');
    }

    try {
      assertRuntimeCommandAllowed(command);
    } catch (err) {
      await this.auditLog(userId, 'runtime.command_denied', { runtimeId, command, reason: (err as Error).message }, clientInfo);
      throw err;
    }

    // Sync workspace files into the host-mounted directory so the container sees
    // the latest content. Failures here are logged but non-fatal.
    const hostPath = await this.resolveWorkspaceHostPath(userId, runtime.workspaceId);
    await this.materializeWorkspace(userId, runtime.workspaceId, hostPath);

    const result = await this.provider.exec(runtime.containerId, command, {
      timeoutMs: RUNTIME_COMMAND_POLICY.timeoutMs,
    });

    // After exec, push any small text files back to the workspace so that
    // outputs (e.g. generated build artifacts under the workspace root) become
    // visible to the agent's read_file tool. Best-effort; failures are logged.
    await this.syncBackWorkspace(userId, runtime.workspaceId, hostPath);

    await db.insert(runtimeLogs).values({
      runtimeId,
      stream: 'stdout',
      content: result.stdout,
    });

    if (result.stderr) {
      await db.insert(runtimeLogs).values({
        runtimeId,
        stream: 'stderr',
        content: result.stderr,
      });
    }

    await db.insert(runtimeEvents).values({
      runtimeId,
      type: 'exec',
      payload: { command, exitCode: result.exitCode },
    });

    await this.auditLog(userId, 'runtime.exec', { runtimeId, command, exitCode: result.exitCode }, clientInfo);

    return result;
  }

  async attachTerminal(runtimeId: string, userId: string) {
    if (!env.RUNTIME_TERMINAL_ENABLED) {
      throw Object.assign(new Error('Runtime terminal is disabled'), { statusCode: 403 });
    }

    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId || runtime.status !== 'running') {
      throw new Error('Runtime not running or container not found');
    }

    return this.provider.attach(runtime.containerId);
  }

  async deleteRuntime(runtimeId: string, userId: string) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId) throw new Error('Runtime or container not found');

    await this.provider.destroy(runtime.containerId);
    await db.delete(runtimes).where(and(eq(runtimes.id, runtimeId), eq(runtimes.userId, userId)));
  }

  private async getRuntime(runtimeId: string, userId: string) {
    return db.query.runtimes.findFirst({
      where: and(eq(runtimes.id, runtimeId), eq(runtimes.userId, userId)),
    });
  }

  async findActiveRuntimeForWorkspace(workspaceId: string, userId: string) {
    await this.assertWorkspaceOwned(workspaceId, userId);
    return db.query.runtimes.findFirst({
      where: and(
        eq(runtimes.userId, userId),
        eq(runtimes.workspaceId, workspaceId),
        ne(runtimes.status, 'destroyed'),
      ),
      orderBy: [desc(runtimes.createdAt)],
    });
  }

  /**
   * Find or create a running runtime for the given workspace.
   * Used by the agent service to ensure run_command has an execution target.
   */
  async ensureRuntimeForWorkspace(
    userId: string,
    workspaceId: string,
    image: string,
    options: any = {},
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.findActiveRuntimeForWorkspace(workspaceId, userId);
    if (existing) {
      if (existing.status !== 'running') {
        try {
          await this.startRuntime(existing.id, userId);
        } catch (err) {
          this.logger.warn(
            { err, runtimeId: existing.id },
            'Failed to restart existing runtime; creating new one',
          );
          // Fall through to create new
        }
      }
      const refreshed = await this.getRuntime(existing.id, userId);
      if (refreshed && refreshed.status === 'running') return refreshed;
    }

    const created = await this.createRuntime(userId, workspaceId, image, options, clientInfo);
    await this.startRuntime(created.id, userId);
    const hostPath = await this.resolveWorkspaceHostPath(userId, workspaceId);
    await this.materializeWorkspace(userId, workspaceId, hostPath);
    return (await this.getRuntime(created.id, userId))!;
  }

  /**
   * Fetches the workspace sync manifest and writes every file/directory into
   * `hostPath`. Used to keep the container's `/workspace` mount aligned with
   * the canonical S3-backed workspace state. Best-effort: errors are logged
   * but do not prevent the exec from running (the container will simply see
   * stale or missing files).
   */
  async materializeWorkspace(userId: string, workspaceId: string, hostPath: string): Promise<void> {
    let manifest: Awaited<ReturnType<WorkspaceClient['getSyncManifest']>>;
    try {
      manifest = await this.workspaceClient.getSyncManifest(userId, workspaceId);
    } catch (err) {
      this.logger.warn({ err, workspaceId }, 'Failed to fetch workspace sync manifest');
      return;
    }

    const rootResolved = resolve(hostPath);

    // Sort so directories are created before nested files.
    const entries = [...manifest.files].sort((a, b) => a.path.length - b.path.length);

    for (const entry of entries) {
      const safeRel = entry.path.replace(/^\/+/, '');
      const target = resolve(hostPath, safeRel);
      // Defense in depth: refuse paths that escape the host root.
      if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
        this.logger.warn({ path: entry.path }, 'Skipping unsafe path during materialize');
        continue;
      }
      try {
        if (entry.isDirectory) {
          await mkdir(target, { recursive: true });
        } else {
          await mkdir(dirname(target), { recursive: true });
          const buf = entry.contentBase64
            ? Buffer.from(entry.contentBase64, 'base64')
            : Buffer.alloc(0);
          await writeFile(target, buf);
        }
      } catch (err) {
        this.logger.warn({ err, path: entry.path }, 'Failed to materialize workspace entry');
      }
    }
  }

  /**
   * After an exec, scan the host-mounted workspace directory and push small
   * text files whose content has changed (or that are new) back to the
   * canonical workspace storage. Skips heavyweight directories such as
   * `node_modules` and `.git` to avoid unbounded uploads. Best-effort.
   */
  async syncBackWorkspace(userId: string, workspaceId: string, hostPath: string): Promise<void> {
    let manifest: Awaited<ReturnType<WorkspaceClient['getSyncManifest']>>;
    try {
      manifest = await this.workspaceClient.getSyncManifest(userId, workspaceId);
    } catch (err) {
      this.logger.warn({ err, workspaceId }, 'Failed to fetch manifest for sync-back');
      return;
    }

    const known = new Map<string, { size: number; contentBase64: string | null }>();
    for (const entry of manifest.files) {
      if (!entry.isDirectory) {
        known.set(entry.path, { size: entry.size, contentBase64: entry.contentBase64 });
      }
    }

    const rootResolved = resolve(hostPath);
    const walked: string[] = [];
    try {
      await this.walkHostDir(rootResolved, rootResolved, walked);
    } catch (err) {
      this.logger.warn({ err, hostPath }, 'Failed to walk host workspace dir for sync-back');
      return;
    }

    for (const absPath of walked) {
      let st;
      try {
        st = await stat(absPath);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      if (st.size > SYNC_BACK_MAX_BYTES) continue;

      const rel = '/' + relative(rootResolved, absPath).split(sep).join('/');
      const previous = known.get(rel);

      let buf: Buffer;
      try {
        buf = await readFile(absPath);
      } catch (err) {
        this.logger.warn({ err, path: rel }, 'Failed to read host file for sync-back');
        continue;
      }

      // Skip files that look binary (contain NUL bytes) and aren't already tracked.
      if (buf.includes(0) && !previous) continue;

      const base64 = buf.toString('base64');
      if (previous && previous.contentBase64 === base64) continue;

      try {
        await this.workspaceClient.writeFile(userId, workspaceId, rel, buf.toString('utf8'));
      } catch (err) {
        this.logger.warn({ err, path: rel }, 'Failed to sync file back to workspace');
      }
    }
  }

  private async walkHostDir(root: string, current: string, out: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SYNC_IGNORE_DIRS.has(entry.name)) continue;
      const abs = join(current, entry.name);
      // Defense in depth: never escape root.
      if (!abs.startsWith(root)) continue;
      if (entry.isDirectory()) {
        await this.walkHostDir(root, abs, out);
      } else if (entry.isFile()) {
        out.push(abs);
      }
    }
  }

  async checkRunningContainersHealth() {
    const runningRuntimes = await db.query.runtimes.findMany({
      where: eq(runtimes.status, 'running'),
    });

    for (const runtime of runningRuntimes) {
      if (!runtime.containerId) continue;
      try {
        const info = await this.provider.inspect(runtime.containerId);
        const violations: string[] = [];

        if (info.hostConfig.privileged) {
          violations.push('privileged');
        }
        if (info.hostConfig.networkMode !== 'none') {
          violations.push('network_mode=' + info.hostConfig.networkMode);
        }
        if (!info.hostConfig.readonlyRootfs) {
          violations.push('readonly_rootfs_disabled');
        }
        if (info.state.oomKilled) {
          violations.push('oom_killed');
        }
        if (!info.state.running) {
          violations.push('not_running');
        }

        if (violations.length > 0) {
          this.logger.warn(
            { runtimeId: runtime.id, containerId: runtime.containerId, violations },
            'Runtime container security violation detected',
          );
          await this.auditLog(runtime.userId, 'runtime.security_violation', {
            runtimeId: runtime.id,
            containerId: runtime.containerId,
            violations,
          });

          try {
            await this.provider.stop(runtime.containerId);
            await db
              .update(runtimes)
              .set({ status: 'stopped', updatedAt: new Date() })
              .where(and(eq(runtimes.id, runtime.id), eq(runtimes.userId, runtime.userId)));
          } catch (err) {
            this.logger.error(
              { err, runtimeId: runtime.id },
              'Failed to stop compromised runtime container',
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          { err, runtimeId: runtime.id, containerId: runtime.containerId },
          'Failed to inspect runtime container during health check',
        );
      }
    }
  }
}
