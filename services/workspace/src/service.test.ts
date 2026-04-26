import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkspaceService } from './service';
import pino from 'pino';

describe.skip('WorkspaceService', () => {
  const logger = pino({ level: 'silent' });
  const workspaceService = new WorkspaceService(logger);

  beforeAll(async () => {
    // Cleanup test data would go here
  });

  afterAll(async () => {
    // Cleanup test data would go here
  });

  it('should create a workspace', async () => {
    // This test requires a valid userId and a running database
    const userId = 'test-user-id';
    const workspace = await workspaceService.createWorkspace(userId, 'Test Workspace');
    
    expect(workspace.name).toBe('Test Workspace');
    expect(workspace.userId).toBe(userId);
  });

  it('should list user workspaces', async () => {
    const userId = 'test-user-id';
    const results = await workspaceService.listUserWorkspaces(userId);
    
    expect(Array.isArray(results)).toBe(true);
  });

  it('should get a specific workspace', async () => {
    const userId = 'test-user-id';
    const workspace = await workspaceService.createWorkspace(userId, 'Test Workspace');
    
    const found = await workspaceService.getWorkspace(workspace.id, userId);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test Workspace');
  });

  it('should delete a workspace (soft delete)', async () => {
    const userId = 'test-user-id';
    const workspace = await workspaceService.createWorkspace(userId, 'Test Workspace');
    
    await workspaceService.deleteWorkspace(workspace.id, userId);
    
    const found = await workspaceService.getWorkspace(workspace.id, userId);
    expect(found?.deletedAt).not.toBeNull();
  });
});