import { db } from '@pcp/db/src/client';
import { hostedServices, hostedServiceLogs, workspaces, auditLogs } from '@pcp/db/src/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import Docker from 'dockerode';
import { encryptEnvVars, decryptEnvVars, redactEnvVars } from './encryption';
import { env } from './env';
import { buildPublishSecurityOptions, resolvePublishImage } from './policy';

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

type HostedServiceUpdate = Partial<{
  workspaceId: string;
  name: string;
  slug: string;
  kind: 'static' | 'vite' | 'node';
  rootPath: string;
  startCommand: string;
  envVars: Record<string, string>;
  isPublic: boolean;
  autoRestart: boolean;
  customDomain: string;
}>;

type HostedServiceRow = typeof hostedServices.$inferSelect;

export class PublishService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async createService(data: {
    userId: string;
    workspaceId: string;
    name: string;
    slug: string;
    kind: 'static' | 'vite' | 'node';
    rootPath: string;
    startCommand?: string;
    envVars?: Record<string, string>;
    isPublic?: boolean;
    autoRestart?: boolean;
    customDomain?: string;
  }) {
    await this.assertWorkspaceOwned(data.workspaceId, data.userId);

    const rootPath = normalizeRootPath(data.rootPath);
    const slug = normalizeSlug(data.slug);
    const startCommand = normalizeStartCommand(data.startCommand);

    const [service] = await db
      .insert(hostedServices)
      .values({
        userId: data.userId,
        workspaceId: data.workspaceId,
        name: data.name,
        slug,
        kind: data.kind,
        rootPath,
        startCommand,
        envVars: encryptEnvVars(data.envVars || {}),
        isPublic: data.isPublic ?? false,
        autoRestart: data.autoRestart ?? true,
        customDomain: data.customDomain,
        status: 'stopped',
      })
      .returning();

    if (!service) throw new Error('Failed to create hosted service');
    await emitAudit(data.userId, 'HOSTED_SERVICE_CREATE', { serviceId: service.id, slug });
    return sanitize(service);
  }

  async updateService(serviceId: string, userId: string, data: HostedServiceUpdate) {
    const updates = normalizeHostedServiceUpdate(data);
    if (updates.workspaceId) {
      await this.assertWorkspaceOwned(updates.workspaceId, userId);
    }
    if (updates.envVars) {
      updates.envVars = encryptEnvVars(updates.envVars);
    }

    const [service] = await db
      .update(hostedServices)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)))
      .returning();

    if (!service) throw new Error('Service not found or update failed');
    await emitAudit(userId, 'HOSTED_SERVICE_UPDATE', {
      serviceId,
      fields: Object.keys(updates),
    });
    return sanitize(service);
  }

  async listServices(workspaceId: string, userId: string) {
    const rows = await db.query.hostedServices.findMany({
      where: and(eq(hostedServices.workspaceId, workspaceId), eq(hostedServices.userId, userId)),
      orderBy: [desc(hostedServices.updatedAt)],
    });
    return rows.map(sanitize);
  }

  async startService(serviceId: string, userId: string) {
    const service = await db.query.hostedServices.findFirst({
      where: and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)),
    });

    if (!service) throw new Error('Service not found');
    await this.assertWorkspaceOwned(service.workspaceId, userId);

    // Update status to starting
    await db
      .update(hostedServices)
      .set({ status: 'starting' })
      .where(and(eq(hostedServices.id, service.id), eq(hostedServices.userId, userId)));

    // Start asynchronously to not block the request
    this.runContainer(service).catch(console.error);
    await emitAudit(userId, 'HOSTED_SERVICE_START', { serviceId });

    return { status: 'starting' };
  }

  async stopService(serviceId: string, userId: string) {
    const service = await db.query.hostedServices.findFirst({
      where: and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)),
    });

    if (!service) throw new Error('Service not found');

    if (service.runnerProcessId) {
      try {
        const container = this.docker.getContainer(service.runnerProcessId);
        await container.stop();
        await container.remove();
      } catch (e) {
        console.error(`Failed to stop container ${service.runnerProcessId}`, e);
      }
    }

    await db
      .update(hostedServices)
      .set({ status: 'stopped', runnerProcessId: null })
      .where(and(eq(hostedServices.id, service.id), eq(hostedServices.userId, userId)));

    await emitAudit(userId, 'HOSTED_SERVICE_STOP', { serviceId });
    return { status: 'stopped' };
  }

  private async runContainer(service: HostedServiceRow) {
    try {
      const containerName = `hosted-${service.id}`;
      const workspaceVolume = `/tmp/workspaces/${service.userId}/${service.workspaceId}`;

      // In MVP, we just use node alpine or nginx depending on kind
      let image = resolvePublishImage(service.kind as 'static' | 'vite' | 'node');
      let cmd: string[] = [];

      if (service.kind === 'static') {
        image = resolvePublishImage('static');
      } else if (service.startCommand) {
        cmd = ['sh', '-c', normalizeStartCommand(service.startCommand) || ''];
      } else if (service.kind === 'node') {
        cmd = ['npm', 'start'];
      } else if (service.kind === 'vite') {
        cmd = ['npm', 'run', 'dev', '--', '--host'];
      }

      // We expose it on traefik
      const rootPath = normalizeRootPath(service.rootPath);
      const slug = normalizeSlug(service.slug);
      const containerPort = service.port
        ? service.port.toString()
        : service.kind === 'static'
          ? '8080'
          : '3000';

      const container = await this.docker.createContainer({
        Image: image,
        name: containerName,
        Cmd: cmd.length > 0 ? cmd : undefined,
        User: '1000:1000',
        WorkingDir: rootPath === '/' ? '/workspace' : `/workspace${rootPath}`,
        Labels: {
          'pcp.service': 'publish',
          'pcp.userId': service.userId,
          'pcp.workspaceId': service.workspaceId,
          'pcp.hostedServiceId': service.id,
          'traefik.enable': 'true',
          [`traefik.http.routers.${containerName}.rule`]: `Host(\`${slug}.apps.localhost\`)`,
          [`traefik.http.routers.${containerName}.entrypoints`]: 'web',
          [`traefik.http.services.${containerName}.loadbalancer.server.port`]: containerPort,
        },
        HostConfig: {
          NetworkMode: 'pcp_network',
          Binds: [`${workspaceVolume}:/workspace:ro`],
          Memory: 512 * 1024 * 1024,
          MemorySwap: 512 * 1024 * 1024,
          NanoCpus: 1_000_000_000,
          ReadonlyRootfs: true,
          Privileged: false,
          Init: true,
          OomKillDisable: false,
          CapDrop: ['ALL'],
          PidsLimit: 100,
          SecurityOpt: buildPublishSecurityOptions({
            seccompProfile: env.PUBLISH_SECCOMP_PROFILE,
            appArmorProfile: env.PUBLISH_APPARMOR_PROFILE,
          }),
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=100m',
          },
          Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 1024 }],
        },
        Env: toSafeEnv(decryptEnvVars(service.envVars || {})),
      });

      await container.start();

      await db
        .update(hostedServices)
        .set({
          status: 'running',
          runnerProcessId: container.id,
          publicUrl: `http://${slug}.apps.localhost`,
        })
        .where(and(eq(hostedServices.id, service.id), eq(hostedServices.userId, service.userId)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish container error';
      await db
        .update(hostedServices)
        .set({
          status: 'crashed',
          crashCount: service.crashCount + 1,
        })
        .where(and(eq(hostedServices.id, service.id), eq(hostedServices.userId, service.userId)));

      await db.insert(hostedServiceLogs).values({
        serviceId: service.id,
        stream: 'stderr',
        line: message,
      });
    }
  }

  async deleteService(serviceId: string, userId: string) {
    await this.stopService(serviceId, userId).catch(() => {});
    await db
      .delete(hostedServices)
      .where(and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)));
    await emitAudit(userId, 'HOSTED_SERVICE_DELETE', { serviceId });
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
}

function normalizeHostedServiceUpdate(data: HostedServiceUpdate): HostedServiceUpdate {
  return {
    ...data,
    slug: data.slug === undefined ? undefined : normalizeSlug(data.slug),
    rootPath: data.rootPath === undefined ? undefined : normalizeRootPath(data.rootPath),
    startCommand:
      data.startCommand === undefined ? undefined : normalizeStartCommand(data.startCommand),
  };
}

function normalizeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(normalized)) {
    throw new Error('Invalid hosted service slug');
  }

  return normalized;
}

function normalizeRootPath(rootPath: string): string {
  const normalized = rootPath.trim().replace(/\\/g, '/');
  if (
    !normalized ||
    normalized.includes('..') ||
    normalized.includes('\0') ||
    normalized.startsWith('~')
  ) {
    throw new Error('Invalid hosted service root path');
  }

  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : '/';
}

function normalizeStartCommand(startCommand: string | null | undefined): string | undefined {
  if (!startCommand) return undefined;
  const normalized = startCommand.trim();
  if (!normalized || /[\r\n\0]/.test(normalized)) {
    throw new Error('Invalid hosted service start command');
  }

  return normalized;
}

function toSafeEnv(env: Record<string, string> | null | undefined): string[] {
  return Object.entries(env || {})
    .filter(([key]) => ENV_NAME_PATTERN.test(key))
    .map(([key, value]) => `${key}=${value}`);
}

/** Replace ciphertext envVars with masked values for client-facing responses. */
function sanitize<T extends { envVars?: Record<string, string> | null }>(service: T): T {
  return { ...service, envVars: redactEnvVars(service.envVars || {}) };
}

async function emitAudit(
  userId: string | null,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ userId, action, details });
  } catch (e) {
    console.error('audit_log emit failed', { action, error: (e as Error).message });
  }
}
