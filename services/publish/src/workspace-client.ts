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

export class WorkspaceClient {
  private readonly baseUrl: string;
  private readonly internalServiceToken: string;

  constructor(
    baseUrl = env.WORKSPACE_SERVICE_URL,
    internalServiceToken = env.INTERNAL_SERVICE_TOKEN,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.internalServiceToken = internalServiceToken;
  }

  async getSyncManifest(userId: string, workspaceId: string): Promise<SyncManifest> {
    const url = `${this.baseUrl}/workspaces/${workspaceId}/sync/manifest`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.internalServiceToken}`,
          'X-User-Id': userId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceClientError(`workspace service unavailable: ${message}`, 502);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new WorkspaceClientError(
        `workspace service ${res.status}: ${text || res.statusText}`,
        res.status,
      );
    }

    try {
      return (await res.json()) as SyncManifest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceClientError(
        `workspace manifest response was not valid JSON: ${message}`,
        502,
      );
    }
  }
}
