import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@pcp/db/src/client';
import { users, auditLogs } from '@pcp/db/src/schema';
import { desc } from 'drizzle-orm';
import { auditLogSchema } from '@pcp/shared';
import { AuthService } from '../service';

export async function setupAdminRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authService = new AuthService(fastify.log);

  // Helper to check if user is admin
  async function checkIsAdmin(request: any, reply: any) {
    const sessionId = request.cookies.sessionId;
    if (!sessionId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
    const user = await authService.validateSession(sessionId);
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }

    // MVP Admin Check: compare against ADMIN_EMAIL env var if set
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
      reply.code(403).send({ error: 'Forbidden' });
      return false;
    }

    return true;
  }

  // List all users
  server.get(
    '/admin/users',
    {
      schema: {
        response: {
          200: z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string().nullable(),
              email: z.string(),
              createdAt: z.date(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      if (!(await checkIsAdmin(request, reply))) return;

      const allUsers = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
      });

      return reply.code(200).send(allUsers);
    }
  );

  // List audit logs
  server.get(
    '/admin/audit-logs',
    {
      schema: {
        response: {
          200: z.array(auditLogSchema),
        },
      },
    },
    async (request, reply) => {
      if (!(await checkIsAdmin(request, reply))) return;

      const logs = await db.query.auditLogs.findMany({
        orderBy: [desc(auditLogs.createdAt)],
        limit: 100, // Limit to recent 100 for MVP
      });

      return reply.code(200).send(logs as any);
    }
  );

  // Simple health check
  server.get(
    '/admin/health',
    async (request, reply) => {
      if (!(await checkIsAdmin(request, reply))) return;

      return reply.code(200).send({
        status: 'healthy',
        dbConnected: true,
        uptime: process.uptime(),
      });
    }
  );
}
