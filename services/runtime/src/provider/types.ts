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

export interface RuntimeProvider {
  create(image: string, options: RuntimeOptions): Promise<string>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  exec(id: string, command: string[]): Promise<ExecResult>;
  attach(id: string): Promise<NodeJS.ReadWriteStream>;
  getStatus(id: string): Promise<string>;
}
