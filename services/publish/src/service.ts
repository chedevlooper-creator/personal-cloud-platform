import { db } from '@pcp/db/src/client';
import { hostedServices, hostedServiceLogs } from '@pcp/db/src/schema';
import { eq, desc, and } from 'drizzle-orm';
import Docker from 'dockerode';

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
    const [service] = await db
      .insert(hostedServices)
      .values({
        userId: data.userId,
        workspaceId: data.workspaceId,
        name: data.name,
        slug: data.slug,
        kind: data.kind,
        rootPath: data.rootPath,
        startCommand: data.startCommand,
        envVars: data.envVars || {},
        isPublic: data.isPublic ?? false,
        autoRestart: data.autoRestart ?? true,
        customDomain: data.customDomain,
        status: 'stopped',
      })
      .returning();

    if (!service) throw new Error('Failed to create hosted service');
    return service;
  }

  async updateService(serviceId: string, userId: string, data: Partial<any>) {
    const [service] = await db
      .update(hostedServices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)))
      .returning();
      
    if (!service) throw new Error('Service not found or update failed');
    return service;
  }

  async listServices(workspaceId: string, userId: string) {
    return db.query.hostedServices.findMany({
      where: and(eq(hostedServices.workspaceId, workspaceId), eq(hostedServices.userId, userId)),
      orderBy: [desc(hostedServices.updatedAt)],
    });
  }

  async startService(serviceId: string, userId: string) {
    const service = await db.query.hostedServices.findFirst({
      where: and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)),
    });

    if (!service) throw new Error('Service not found');

    // Update status to starting
    await db
      .update(hostedServices)
      .set({ status: 'starting' })
      .where(eq(hostedServices.id, service.id));

    // Start asynchronously to not block the request
    this.runContainer(service).catch(console.error);

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
      .where(eq(hostedServices.id, service.id));

    return { status: 'stopped' };
  }

  private async runContainer(service: any) {
    try {
      const containerName = `hosted-${service.id}`;
      const workspaceVolume = `/tmp/workspaces/${service.workspaceId}`;

      // In MVP, we just use node alpine or nginx depending on kind
      let image = 'node:20-alpine';
      let cmd: string[] = [];
      
      if (service.kind === 'static') {
        image = 'nginx:alpine';
      } else if (service.startCommand) {
        cmd = ['sh', '-c', service.startCommand];
      } else if (service.kind === 'node') {
        cmd = ['npm', 'start'];
      } else if (service.kind === 'vite') {
        cmd = ['npm', 'run', 'dev', '--', '--host'];
      }

      // We expose it on traefik
      const container = await this.docker.createContainer({
        Image: image,
        name: containerName,
        Cmd: cmd.length > 0 ? cmd : undefined,
        WorkingDir: `/workspace${service.rootPath}`,
        Labels: {
          'traefik.enable': 'true',
          [`traefik.http.routers.${containerName}.rule`]: `Host(\`${service.slug}.apps.localhost\`)`,
          [`traefik.http.routers.${containerName}.entrypoints`]: 'web',
          [`traefik.http.services.${containerName}.loadbalancer.server.port`]: service.port ? service.port.toString() : (service.kind === 'static' ? '80' : '3000'),
        },
        HostConfig: {
          NetworkMode: 'pcp_network',
          Binds: [`${workspaceVolume}:/workspace`],
        },
        Env: Object.entries(service.envVars || {}).map(([k, v]) => `${k}=${v}`),
      });

      await container.start();

      await db
        .update(hostedServices)
        .set({ 
          status: 'running',
          runnerProcessId: container.id,
          publicUrl: `http://${service.slug}.apps.localhost`
        })
        .where(eq(hostedServices.id, service.id));

    } catch (error: any) {
      await db
        .update(hostedServices)
        .set({ 
          status: 'crashed',
          crashCount: service.crashCount + 1,
        })
        .where(eq(hostedServices.id, service.id));
        
      await db.insert(hostedServiceLogs).values({
        serviceId: service.id,
        stream: 'stderr',
        line: error.message,
      });
    }
  }

  async deleteService(serviceId: string, userId: string) {
    await this.stopService(serviceId, userId).catch(() => {});
    await db.delete(hostedServices).where(and(eq(hostedServices.id, serviceId), eq(hostedServices.userId, userId)));
  }
}
