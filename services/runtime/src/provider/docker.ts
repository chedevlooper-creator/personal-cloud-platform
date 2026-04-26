import Docker from 'dockerode';
import { RuntimeProvider, RuntimeOptions, ExecResult } from './types';

export class DockerProvider implements RuntimeProvider {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async create(image: string, options: RuntimeOptions): Promise<string> {
    const container = await this.docker.createContainer({
      Image: image,
      HostConfig: {
        Binds: [`${options.workspacePath}:/workspace`],
        Memory: options.memory ? options.memory * 1024 * 1024 : undefined,
        NanoCpus: options.cpu ? options.cpu * 1e9 : undefined,
        NetworkMode: 'none', // Default security: no network
      },
      Env: Object.entries(options.env || {}).map(([k, v]) => `${k}=${v}`),
      WorkingDir: '/workspace',
      Tty: true,
      Cmd: ['/bin/sh'],
    });

    return container.id;
  }

  async start(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.start();
  }

  async stop(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.stop();
  }

  async destroy(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    try {
      await container.stop();
    } catch (e) {}
    await container.remove();
  }

  async exec(id: string, command: string[]): Promise<ExecResult> {
    const container = this.docker.getContainer(id);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({});
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      container.modem.demuxStream(stream, {
        write: (chunk: Buffer) => { stdout += chunk.toString(); },
      } as any, {
        write: (chunk: Buffer) => { stderr += chunk.toString(); },
      } as any);

      stream.on('end', async () => {
        const status = await exec.inspect();
        resolve({
          exitCode: status.ExitCode || 0,
          stdout,
          stderr,
        });
      });

      stream.on('error', reject);
    });
  }

  async attach(id: string): Promise<NodeJS.ReadWriteStream> {
    const container = this.docker.getContainer(id);
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    });
    return stream;
  }

  async getStatus(id: string): Promise<string> {
    const container = this.docker.getContainer(id);
    const data = await container.inspect();
    return data.State.Status;
  }
}
