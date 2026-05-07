import { describe, expect, it, vi } from 'vitest';
import { ReadFileTool } from './read_file';
import { ToolContext } from './registry';

const mockContext = {
  userId: 'u1',
  workspaceId: 'w1',
  taskId: 't1',
  clients: {
    workspace: {
      getFileContent: vi.fn(),
    },
  },
} as unknown as ToolContext;

describe('ReadFileTool', () => {
  it('reads and returns file content', async () => {
    const tool = new ReadFileTool();
    vi.mocked(mockContext.clients.workspace.getFileContent).mockResolvedValue({
      content: 'hello world',
      path: '/test.txt',
      name: 'test.txt',
      mimeType: 'text/plain',
      size: 11,
    });

    const result = await tool.execute({ path: '/test.txt' }, mockContext);
    expect(result).toBe('hello world');
    expect(mockContext.clients.workspace.getFileContent).toHaveBeenCalledWith('u1', 'w1', '/test.txt');
  });

  it('truncates content over 64KB', async () => {
    const tool = new ReadFileTool();
    const largeContent = 'a'.repeat(70 * 1024);
    vi.mocked(mockContext.clients.workspace.getFileContent).mockResolvedValue({
      content: largeContent,
      path: '/big.txt',
      name: 'big.txt',
      mimeType: 'text/plain',
      size: largeContent.length,
    });

    const result = await tool.execute({ path: '/big.txt' }, mockContext);
    expect(result).toContain('[truncated:');
    expect(result.length).toBeLessThan(largeContent.length);
  });

  it('returns an error message when the file is not found', async () => {
    const tool = new ReadFileTool();
    vi.mocked(mockContext.clients.workspace.getFileContent).mockRejectedValue({
      status: 404,
      message: 'File not found',
    });

    const result = await tool.execute({ path: '/missing.txt' }, mockContext);
    expect(result).toContain('Error reading /missing.txt');
    expect(result).toContain('404');
  });

  it('does not require approval', () => {
    const tool = new ReadFileTool();
    expect(tool.requiresApproval).toBe(false);
  });
});
