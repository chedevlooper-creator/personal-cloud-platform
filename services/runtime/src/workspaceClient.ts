import { env } from './env';

export interface SyncManifestEntry {
  path: string;
  isDirectory: boolean;
  size: number;
  mimeType: string | null;
  contentBase64: string | null;
}

export interface SyncManifest {
  files: SyncManifestEntry[];
}

export class WorkspaceClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'WorkspaceClientError';
  }
}

/**
 * Minimal HTTP client for the workspace service. Authenticates with the shared
 * INTERNAL_SERVICE_TOKEN + acting user id.
 */
export class WorkspaceClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? env.WORKSPACE_SERVICE_URL).replace(/\/+$/, '');
  }

  async getSyncManifest(
    userId: string,
    workspaceId: string,
    opts: { maxInlineBytes?: number } = {},
  ): Promise<SyncManifest> {
    const url = new URL(`${this.baseUrl}/workspaces/${workspaceId}/sync/manifest`);
    if (opts.maxInlineBytes != null) {
      url.searchParams.set('maxInlineBytes', String(opts.maxInlineBytes));
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
        'X-User-Id': userId,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new WorkspaceClientError(
        `workspace ${res.status}: ${text || res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as SyncManifest;
  }

  async writeFile(
    userId: string,
    workspaceId: string,
    filePath: string,
    content: string,
    mimeType = 'text/plain',
  ): Promise<{ bytesWritten: number; path: string }> {
    const res = await fetch(`${this.baseUrl}/workspaces/${workspaceId}/files/write`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
        'X-User-Id': userId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath, content, mimeType }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new WorkspaceClientError(
        `workspace ${res.status}: ${text || res.statusText}`,
        res.status,
      );
    }
    return (await res.json()) as { bytesWritten: number; path: string };
  }
}
