import { describe, expect, it, vi } from 'vitest';
import { WriteFileTool } from './write_file';
import { ToolContext } from './registry';

const mockContext = {
  userId: 'u1',
  workspaceId: 'w1',
  taskId: 't1',
  clients: {
    workspace: {
      writeFile: vi.fn(),
    },
  },
} as unknown as ToolContext;

describe('WriteFileTool', () => {
  it('writes a file and reports bytes written', async () => {
    const tool = new WriteFileTool();
    vi.mocked(mockContext.clients.workspace.writeFile).mockResolvedValue({
      bytesWritten: 11,
    });

    const result = await tool.execute(
      { path: '/test.txt', content: 'hello world' },
      mockContext,
    );
    expect(result).toBe('Wrote 11 bytes to /test.txt');
    expect(mockContext.clients.workspace.writeFile).toHaveBeenCalledWith(
      'u1',
      'w1',
      '/test.txt',
      'hello world',
      'text/plain',
    );
  });

  it('uses custom mimeType when provided', async () => {
    const tool = new WriteFileTool();
    vi.mocked(mockContext.clients.workspace.writeFile).mockResolvedValue({
      bytesWritten: 5,
    });

    await tool.execute(
      { path: '/app.js', content: 'const x=1', mimeType: 'application/javascript' },
      mockContext,
    );
    expect(mockContext.clients.workspace.writeFile).toHaveBeenCalledWith(
      'u1',
      'w1',
      '/app.js',
      'const x=1',
      'application/javascript',
    );
  });

  it('returns an error message when write fails', async () => {
    const tool = new WriteFileTool();
    vi.mocked(mockContext.clients.workspace.writeFile).mockRejectedValue({
      status: 403,
      message: 'Quota exceeded',
    });

    const result = await tool.execute(
      { path: '/test.txt', content: 'hello' },
      mockContext,
    );
    expect(result).toContain('Error writing /test.txt');
    expect(result).toContain('403');
  });

  it('requires approval', () => {
    const tool = new WriteFileTool();
    expect(tool.requiresApproval).toBe(true);
  });
});
