import { env } from '../env';
import { internalRequest } from './http';

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
    const result = await internalRequest<{ files: FileMetadata[] }>(env.WORKSPACE_SERVICE_URL, {
      userId,
      method: 'GET',
      path: `/workspaces/${workspaceId}/files`,
      query: { path },
    });
    return result.files;
  }

  async getFileContent(
    userId: string,
    workspaceId: string,
    path: string,
  ): Promise<FileContentResponse> {
    return internalRequest<FileContentResponse>(env.WORKSPACE_SERVICE_URL, {
      userId,
      method: 'GET',
      path: `/workspaces/${workspaceId}/files/content`,
      query: { path },
    });
  }

  async writeFile(
    userId: string,
    workspaceId: string,
    path: string,
    content: string,
    mimeType = 'text/plain',
  ): Promise<{ bytesWritten: number }> {
    // Use multipart-style upload via raw PUT body since the existing service exposes streaming upload.
    // For text content, fall back to creating/updating via the file metadata endpoint and writing content
    // through the dedicated update-content endpoint if present.
    return internalRequest<{ bytesWritten: number }>(env.WORKSPACE_SERVICE_URL, {
      userId,
      method: 'POST',
      path: `/workspaces/${workspaceId}/files/write`,
      body: { path, content, mimeType },
    });
  }
}
