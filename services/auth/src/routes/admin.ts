import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@pcp/db/src/client';
import { users, auditLogs } from '@pcp/db/src/schema';
import { desc } from 'drizzle-orm';
import { auditLogSchema, sendApiError } from '@pcp/shared';
import { AuthService, SanitizedUser } from '../service';
import { env } from '../env';

export function isAdminUser(user: SanitizedUser, adminEmail: string | undefined): boolean {
  if (!adminEmail) return false;
  return user.email.toLowerCase() === adminEmail.toLowerCase();
}

function normalizeAuditDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }

  return details as Record<string, unknown>;
}

export async function setupAdminRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authService = new AuthService(fastify.log);

  // Helper to check if user is admin
  async function checkIsAdmin(request: FastifyRequest, reply: FastifyReply) {
    const sessionId = request.cookies.sessionId;
    if (!sessionId) {
      sendApiError(reply, 401, 'UNAUTHORIZED');
      return false;
    }
    const user = await authService.validateSession(sessionId);
    if (!user) {
      sendApiError(reply, 401, 'UNAUTHORIZED');
      return false;
    }

    // MVP admin policy: fail closed unless an explicit admin email is configured.
    if (!isAdminUser(user, env.ADMIN_EMAIL)) {
      sendApiError(reply, 403, 'FORBIDDEN');
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
            }),
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
    },
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

      return reply.code(200).send(
        logs.map((log) => ({
          ...log,
          details: normalizeAuditDetails(log.details),
        })),
      );
    },
  );

  // Simple health check
  server.get('/admin/health', async (request, reply) => {
    if (!(await checkIsAdmin(request, reply))) return;

    return reply.code(200).send({
      status: 'healthy',
      dbConnected: true,
      uptime: process.uptime(),
    });
  });
}
