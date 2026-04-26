import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishService } from '../src/service';
import { db } from '@pcp/db/src/client';

vi.mock('@pcp/db/src/client', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    query: {
      publishedApps: {
        findFirst: vi.fn(),
      },
      appDeployments: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

describe('PublishService', () => {
  let service: PublishService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PublishService();
    // Mock docker interactions to avoid actual socket connections during tests
    (service as any).docker = {
      createContainer: vi.fn().mockResolvedValue({
        id: 'container-123',
        start: vi.fn().mockResolvedValue(true),
      }),
      getContainer: vi.fn().mockReturnValue({
        stop: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true),
      }),
    };
  });

  it('should create an app', async () => {
    const mockApp = {
      id: 'app-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      name: 'Test App',
      subdomain: 'test-app',
      config: {},
    };

    (db.insert as any)().values().returning.mockResolvedValueOnce([mockApp]);

    const app = await service.createApp({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      name: 'Test App',
      subdomain: 'test-app',
    });

    expect(app.id).toBe('app-1');
    expect(db.insert).toHaveBeenCalled();
  });

  it('should deploy an app', async () => {
    const mockApp = {
      id: 'app-1',
      subdomain: 'test-app',
    };
    const mockDeployment = {
      id: 'dep-1',
      appId: 'app-1',
      version: 'v1.0.0',
      status: 'building',
    };

    (db.query.publishedApps.findFirst as any).mockResolvedValueOnce(mockApp);
    (db.insert as any)().values().returning.mockResolvedValueOnce([mockDeployment]);
    (db.update as any)().set().where.mockResolvedValueOnce([mockDeployment]); // for running

    const result = await service.deployApp('app-1', 'v1.0.0');

    expect(result.deploymentId).toBe('dep-1');
    expect(result.status).toBe('building');
  });

  it('should get deployments', async () => {
    const mockDeployments = [
      { id: 'dep-1', version: 'v1.0.0' },
      { id: 'dep-2', version: 'v1.0.1' },
    ];

    (db.query.appDeployments.findMany as any).mockResolvedValueOnce(mockDeployments);

    const deployments = await service.getDeployments('app-1');
    expect(deployments).toHaveLength(2);
  });
});
