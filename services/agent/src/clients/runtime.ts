import { env } from '../env';
import { internalRequest } from './http';

export interface RuntimeRecord {
  id: string;
  workspaceId: string;
  image: string;
  status: string;
  createdAt: string | Date;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class RuntimeClient {
  async ensureForWorkspace(
    userId: string,
    workspaceId: string,
    image: string = env.RUNTIME_DEFAULT_IMAGE,
  ): Promise<RuntimeRecord> {
    return internalRequest<RuntimeRecord>(env.RUNTIME_SERVICE_URL, {
      userId,
      method: 'POST',
      path: '/runtimes/ensure',
      body: { workspaceId, image },
    });
  }

  async exec(userId: string, runtimeId: string, command: string[]): Promise<ExecResult> {
    return internalRequest<ExecResult>(env.RUNTIME_SERVICE_URL, {
      userId,
      method: 'POST',
      path: `/runtimes/${runtimeId}/exec`,
      body: { command },
    });
  }
}
