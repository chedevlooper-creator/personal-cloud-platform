import { db } from '@pcp/db/src/client';
import { publishedApps, appDeployments } from '@pcp/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import Docker from 'dockerode';

export class PublishService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' }); // Adjust for Windows if needed, though Dockerode usually defaults well
  }

  async createApp(data: {
    userId: string;
    workspaceId: string;
    name: string;
    subdomain: string;
    config?: any;
  }) {
    const [app] = await db
      .insert(publishedApps)
      .values({
        userId: data.userId,
        workspaceId: data.workspaceId,
        name: data.name,
        subdomain: data.subdomain,
        config: data.config || {},
      })
      .returning();

    if (!app) throw new Error('Failed to create app');
    return app;
  }

  async deployApp(appId: string, version: string) {
    const app = await db.query.publishedApps.findFirst({
      where: eq(publishedApps.id, appId),
    });

    if (!app) throw new Error('App not found');

    const [deployment] = await db
      .insert(appDeployments)
      .values({
        appId,
        version,
        status: 'building',
      })
      .returning();

    if (!deployment) throw new Error('Failed to create deployment');

    // Start deployment process asynchronously
    this.runDeployment(app, deployment).catch(console.error);

    return {
      deploymentId: deployment.id,
      status: deployment.status,
    };
  }

  private async runDeployment(app: any, deployment: any) {
    try {
      // For MVP, we just spin up a simple Node or Nginx container based on workspace contents.
      // We will use a generic nginx image and mount a dummy volume for now,
      // or simply run a container that serves "Hello World" with Traefik labels.
      
      const containerName = `app-${app.id}-${deployment.version}`;
      
      // Update status to running
      await db
        .update(appDeployments)
        .set({ status: 'running' })
        .where(eq(appDeployments.id, deployment.id));

      const container = await this.docker.createContainer({
        Image: 'nginx:alpine',
        name: containerName,
        Labels: {
          'traefik.enable': 'true',
          [`traefik.http.routers.${containerName}.rule`]: `Host(\`${app.subdomain}.apps.platform.com\`)`,
          [`traefik.http.routers.${containerName}.entrypoints`]: 'web',
          [`traefik.http.services.${containerName}.loadbalancer.server.port`]: '80',
        },
        HostConfig: {
          NetworkMode: 'pcp_network', // Ensure this matches your traefik network
        },
      });

      await container.start();

      await db
        .update(appDeployments)
        .set({ 
          status: 'running',
          containerId: container.id 
        })
        .where(eq(appDeployments.id, deployment.id));

    } catch (error: any) {
      await db
        .update(appDeployments)
        .set({ 
          status: 'failed',
          logs: { error: error.message }
        })
        .where(eq(appDeployments.id, deployment.id));
    }
  }

  async getDeployments(appId: string) {
    const deployments = await db.query.appDeployments.findMany({
      where: eq(appDeployments.appId, appId),
      orderBy: [desc(appDeployments.createdAt)],
    });

    return deployments;
  }

  async deleteApp(appId: string) {
    const app = await db.query.publishedApps.findFirst({
      where: eq(publishedApps.id, appId),
    });

    if (!app) throw new Error('App not found');

    // Stop and remove all related containers
    const deployments = await this.getDeployments(appId);
    for (const dep of deployments) {
      if (dep.containerId) {
        try {
          const container = this.docker.getContainer(dep.containerId);
          await container.stop();
          await container.remove();
        } catch (e) {
          console.error(`Failed to remove container ${dep.containerId}`, e);
        }
      }
    }

    await db.delete(publishedApps).where(eq(publishedApps.id, appId));
  }
}
