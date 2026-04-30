export interface RuntimeOptions {
  cpu?: number;
  memory?: number;
  env?: Record<string, string>;
  workspacePath: string;
  labels?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RuntimeExecOptions {
  timeoutMs?: number;
}

export class RuntimeExecTimeoutError extends Error {
  statusCode = 408;

  constructor(timeoutMs: number) {
    super(`Command execution timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    this.name = 'RuntimeExecTimeoutError';
  }
}

export interface RuntimeContainerInfo {
  id: string;
  state: {
    status: string;
    running: boolean;
    pid: number;
    oomKilled: boolean;
  };
  hostConfig: {
    networkMode: string;
    readonlyRootfs: boolean;
    privileged: boolean;
    pidMode?: string;
    capDrop?: string[];
  };
}

export interface RuntimeProvider {
  create(image: string, options: RuntimeOptions): Promise<string>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  exec(id: string, command: string[], options?: RuntimeExecOptions): Promise<ExecResult>;
  attach(id: string): Promise<NodeJS.ReadWriteStream>;
  getStatus(id: string): Promise<string>;
  inspect(id: string): Promise<RuntimeContainerInfo>;
}
