import { createInternalClient, createCircuitBreaker } from '@pcp/shared';
import { env } from '../env';

const client = createInternalClient({
  baseUrl: env.WORKSPACE_SERVICE_URL,
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
});

const breaker = createCircuitBreaker({ name: 'workspace-client' });

export interface FileMetadata {
  id: string;
  workspaceId: string;
  path: string;
  name: string;
  mimeType: string | null;
  size: number;
  isDirectory: boolean;
  parentPath: string | null;
}

export interface FileContentResponse {
  path: string;
  name: string;
  mimeType: string | null;
  size: number;
  content: string;
  truncated?: boolean;
}

export class WorkspaceClient {
  async listFiles(userId: string, workspaceId: string, path: string): Promise<FileMetadata[]> {
    const result = await breaker.execute(() =>
      client.request<{ files: FileMetadata[] }>({
        userId,
        path: `/workspaces/${workspaceId}/files`,
        query: { path },
      }),
    );
    return result.files;
  }

  async getFileContent(
    userId: string,
    workspaceId: string,
    path: string,
  ): Promise<FileContentResponse> {
    return breaker.execute(() =>
      client.request<FileContentResponse>({
        userId,
        path: `/workspaces/${workspaceId}/files/content`,
        query: { path },
      }),
    );
  }

  async writeFile(
    userId: string,
    workspaceId: string,
    path: string,
    content: string,
    mimeType = 'text/plain',
  ): Promise<{ bytesWritten: number }> {
    return breaker.execute(() =>
      client.request<{ bytesWritten: number }>({
        userId,
        method: 'POST',
        path: `/workspaces/${workspaceId}/files/write`,
        body: { path, content, mimeType },
      }),
    );
  }
}
