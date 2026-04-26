import { db } from '@pcp/db/src/client';
import { runtimes, runtimeLogs, runtimeEvents, sessions, users } from '@pcp/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { DockerProvider } from './provider/docker';
import { RuntimeProvider } from './provider/types';

export class RuntimeService {
  private provider: RuntimeProvider;

  constructor(private logger: any) {
    this.provider = new DockerProvider();
    this.logger.info('RuntimeService initialized');
  }

  async validateUserFromCookie(sessionId: string): Promise<string | null> {
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

  async createRuntime(userId: string, workspaceId: string, image: string, options: any) {
    // In a real scenario, we would determine hostWorkspacePath from workspaceId
    const hostWorkspacePath = `/tmp/workspaces/${workspaceId}`; // Dummy path for now

    const containerId = await this.provider.create(image, {
      ...options,
      workspacePath: hostWorkspacePath,
    });

    const [runtime] = await db.insert(runtimes).values({
      userId,
      workspaceId,
      image,
      containerId,
      options,
      status: 'pending',
    }).returning();

    if (!runtime) throw new Error('Failed to create runtime record');

    await db.insert(runtimeEvents).values({
      runtimeId: runtime.id,
      type: 'create',
      payload: { containerId, options },
    });

    return runtime;
  }

  async startRuntime(runtimeId: string, userId: string) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId) throw new Error('Runtime or container not found');

    await this.provider.start(runtime.containerId);
    
    await db.update(runtimes)
      .set({ status: 'running', lastStartedAt: new Date() })
      .where(eq(runtimes.id, runtimeId));

    await db.insert(runtimeEvents).values({
      runtimeId,
      type: 'start',
    });
  }

  async stopRuntime(runtimeId: string, userId: string) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId) throw new Error('Runtime or container not found');

    await this.provider.stop(runtime.containerId);
    
    await db.update(runtimes)
      .set({ status: 'stopped', lastStoppedAt: new Date() })
      .where(eq(runtimes.id, runtimeId));

    await db.insert(runtimeEvents).values({
      runtimeId,
      type: 'stop',
    });
  }

  async execCommand(runtimeId: string, userId: string, command: string[]) {
    const runtime = await this.getRuntime(runtimeId, userId);
    if (!runtime || !runtime.containerId || runtime.status !== 'running') {
      throw new Error('Runtime not running or container not found');
    }

    const result = await this.provider.exec(runtime.containerId, command);

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

    return result;
  }

  async attachTerminal(runtimeId: string, userId: string) {
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
    await db.delete(runtimes).where(eq(runtimes.id, runtimeId));
  }

  private async getRuntime(runtimeId: string, userId: string) {
    return db.query.runtimes.findFirst({
      where: and(
        eq(runtimes.id, runtimeId),
        eq(runtimes.userId, userId)
      ),
    });
  }
}
