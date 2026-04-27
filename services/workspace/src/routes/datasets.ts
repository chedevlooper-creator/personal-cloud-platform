import { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import {
  datasetResponseSchema,
  queryDatasetSchema,
  queryResultSchema,
} from '@pcp/shared';
import { DatasetsService } from '../datasets/service';
import { WorkspaceService } from '../service';
import { env } from '../env';

const SOURCE_TYPE_BY_EXT: Record<string, 'csv' | 'json' | 'parquet'> = {
  '.csv': 'csv',
  '.tsv': 'csv',
  '.json': 'json',
  '.ndjson': 'json',
  '.jsonl': 'json',
  '.parquet': 'parquet',
};

function toResponse(row: any) {
  return {
    id: row.id,
    name: row.name,
    tableName: row.tableName,
    sourceType: row.sourceType,
    sourceFilename: row.sourceFilename ?? null,
    columns: Array.isArray(row.columns) ? row.columns : [],
    rowCount: Number(row.rowCount ?? 0),
    sizeBytes: Number(row.sizeBytes ?? 0),
    version: Number(row.version ?? 1),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export async function setupDatasetsRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const workspaceService = new WorkspaceService(fastify.log);
  const datasetsService = new DatasetsService(fastify.log);

  async function authUser(request: FastifyRequest): Promise<string | null> {
    const auth = request.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      const headerUserId = request.headers['x-user-id'];
      if (
        token &&
        token === env.INTERNAL_SERVICE_TOKEN &&
        typeof headerUserId === 'string' &&
        headerUserId.length > 0
      ) {
        return headerUserId;
      }
    }
    const sessionId = request.cookies.sessionId;
    if (!sessionId) return null;
    return workspaceService.validateUserFromCookie(sessionId);
  }

  server.get(
    '/datasets',
    {
      schema: {
        response: {
          200: z.object({ datasets: z.array(datasetResponseSchema) }),
        },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      const rows = await datasetsService.list(userId);
      return { datasets: rows.map(toResponse) };
    },
  );

  server.delete(
    '/datasets/:id',
    {
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        await datasetsService.remove(userId, request.params.id);
        return { success: true };
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.code(status).send({ error: err?.message ?? 'Internal error' } as any);
      }
    },
  );

  server.post(
    '/datasets/:id/query',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: queryDatasetSchema,
        response: { 200: queryResultSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      const ds = await datasetsService.get(userId, request.params.id);
      if (!ds) return reply.code(404).send({ error: 'Dataset not found' } as any);
      try {
        return await datasetsService.query({
          userId,
          sql: request.body.sql,
          rowLimit: request.body.rowLimit,
        });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        if (status === 500) fastify.log.error({ err }, 'dataset query failed');
        return reply.code(status).send({ error: err?.message ?? 'Query failed' } as any);
      }
    },
  );

  server.post(
    '/datasets/query',
    {
      schema: {
        body: queryDatasetSchema,
        response: { 200: queryResultSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        return await datasetsService.query({
          userId,
          sql: request.body.sql,
          rowLimit: request.body.rowLimit,
        });
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        if (status === 500) fastify.log.error({ err }, 'dataset query failed');
        return reply.code(status).send({ error: err?.message ?? 'Query failed' } as any);
      }
    },
  );

  server.get(
    '/datasets/:id/preview',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).optional() }),
        response: { 200: queryResultSchema },
      },
    },
    async (request, reply) => {
      const userId = await authUser(request);
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' } as any);
      try {
        return await datasetsService.preview(userId, request.params.id, request.query.limit);
      } catch (err: any) {
        const status = err?.statusCode ?? 500;
        return reply.code(status).send({ error: err?.message ?? 'Preview failed' } as any);
      }
    },
  );

  // Multipart upload + import. Field name for the file part is "file"; an optional
  // text field "name" overrides the dataset display name.
  server.post('/datasets/import', async (request, reply) => {
    const userId = await authUser(request);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Expected multipart/form-data' });
    }

    let displayName: string | undefined;
    let savedPath: string | undefined;
    let originalFilename: string | undefined;
    let sourceType: 'csv' | 'json' | 'parquet' | undefined;

    try {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudmind-ds-'));
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'name') {
          displayName = String(part.value);
        } else if (part.type === 'file') {
          originalFilename = part.filename;
          const ext = path.extname(part.filename).toLowerCase();
          const detected = SOURCE_TYPE_BY_EXT[ext];
          if (!detected) {
            await part.file.resume();
            return reply.code(400).send({
              error: `Unsupported file type "${ext}". Use .csv, .tsv, .json, .ndjson, or .parquet.`,
            });
          }
          sourceType = detected;
          savedPath = path.join(tmpDir, `upload${ext}`);
          await pipeline(part.file, createWriteStream(savedPath));
        }
      }

      if (!savedPath || !sourceType || !originalFilename) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      const finalName =
        (displayName?.trim() || path.basename(originalFilename, path.extname(originalFilename))) ||
        'dataset';

      const inserted = await datasetsService.importFile({
        userId,
        name: finalName,
        filePath: savedPath,
        sourceFilename: originalFilename,
        sourceType,
      });
      return reply.code(201).send(toResponse(inserted));
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      if (status === 500) fastify.log.error({ err }, 'dataset import failed');
      return reply.code(status).send({ error: err?.message ?? 'Import failed' });
    } finally {
      if (savedPath) {
        await fs.rm(path.dirname(savedPath), { recursive: true, force: true }).catch(() => {});
      }
    }
  });
}
