import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createSkillSchema,
  skillResponseSchema,
  updateSkillSchema,
  apiErrorCodeFromStatus,
  sendApiError,
} from '@pcp/shared';
import { SkillsService } from '../skills/service';
import { SKILL_CATALOG } from '../skills/catalog';
import {
  buildLocalSlug,
  getCurated,
  getSkillDetail,
  listSkills,
  parseSkillMd,
  searchSkills,
  type RegistrySkill,
} from '../skills/registry';
import { AgentOrchestrator } from '../orchestrator';
import { env } from '../env';

export async function setupSkillsRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService();
  const orchestrator = new AgentOrchestrator(fastify.log);

  async function getUserId(sessionId: string | undefined): Promise<string | null> {
    if (env.AUTH_BYPASS) return 'local-dev-user';
    if (!sessionId) return null;
    return orchestrator.validateUserFromCookie(sessionId);
  }

  server.get(
    '/skills',
    { schema: { response: { 200: z.object({ skills: z.array(skillResponseSchema) }) } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const rows = await service.list(userId);
      return { skills: rows };
    },
  );

  server.post(
    '/skills',
    { schema: { body: createSkillSchema, response: { 201: skillResponseSchema } } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const row = await service.create(userId, request.body);
        return reply.code(201).send(row);
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to create skill',
        );
      }
    },
  );

  server.patch(
    '/skills/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateSkillSchema,
        response: { 200: skillResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const row = await service.update(request.params.id, userId, request.body);
        return row;
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to update skill',
        );
      }
    },
  );

  server.delete(
    '/skills/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        await service.remove(request.params.id, userId);
        return { success: true };
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to delete skill',
        );
      }
    },
  );

  // Built-in catalog of preset skills the user can one-click install.
  server.get(
    '/skills/catalog',
    {
      schema: {
        response: {
          200: z.object({
            skills: z.array(
              z.object({
                slug: z.string(),
                name: z.string(),
                description: z.string(),
                category: z.string(),
                triggers: z.array(z.string()),
                bodyMarkdown: z.string(),
                installed: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const installed = await service.list(userId);
      const installedSlugs = new Set(installed.map((s) => s.slug));
      return {
        skills: SKILL_CATALOG.map((s) => ({ ...s, installed: installedSlugs.has(s.slug) })),
      };
    },
  );

  // Install a preset skill into the user's library by slug.
  server.post(
    '/skills/install',
    {
      schema: {
        body: z.object({ slug: z.string().min(1).max(120) }),
        response: { 201: skillResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const preset = SKILL_CATALOG.find((s) => s.slug === request.body.slug);
      if (!preset) return sendApiError(reply, 404, 'NOT_FOUND', 'Catalog skill not found');
      try {
        const row = await service.create(userId, {
          slug: preset.slug,
          name: preset.name,
          description: preset.description,
          bodyMarkdown: preset.bodyMarkdown,
          triggers: preset.triggers,
          enabled: true,
        });
        return reply.code(201).send(row);
      } catch (err: any) {
        const status = err.statusCode ?? 400;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          err.message ?? 'Failed to install skill',
        );
      }
    },
  );

  server.post(
    '/skills/match',
    {
      schema: {
        body: z.object({ input: z.string().min(1).max(20000) }),
        response: { 200: z.object({ skills: z.array(skillResponseSchema) }) },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      const matched = await service.matchTriggers(userId, request.body.input);
      return { skills: matched };
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // skills.sh registry integration
  //
  // Browse, search and one-click install community skills published on
  // https://skills.sh. Each registry skill resolves to a SKILL.md file that
  // we parse and persist as a regular local skill bound to the user.
  // ───────────────────────────────────────────────────────────────────────────

  const registrySkillSchema = z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    source: z.string(),
    installs: z.number().int().nonnegative(),
    sourceType: z.string(),
    installUrl: z.string().nullable(),
    url: z.string(),
    isDuplicate: z.boolean().optional(),
  });

  function annotate(items: RegistrySkill[], installedSourceIds: Set<string>) {
    return items.map((s) => ({ ...s, installed: installedSourceIds.has(s.id) }));
  }

  async function loadInstalledSourceIds(userId: string): Promise<Set<string>> {
    const installed = await service.list(userId);
    const ids = new Set<string>();
    for (const row of installed) {
      if (row.sourcePath?.startsWith('skills.sh:')) {
        ids.add(row.sourcePath.slice('skills.sh:'.length));
      }
    }
    return ids;
  }

  server.get(
    '/skills/registry',
    {
      schema: {
        querystring: z.object({
          view: z.enum(['all-time', 'trending', 'hot']).default('trending'),
          q: z.string().min(2).max(200).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        }),
        response: {
          200: z.object({
            skills: z.array(registrySkillSchema.extend({ installed: z.boolean() })),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const { view, q, limit } = request.query;
        const items = q ? await searchSkills(q, limit) : await listSkills(view, limit);
        const installed = await loadInstalledSourceIds(userId);
        return { skills: annotate(items, installed) };
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode ?? 502;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          (err as Error).message ?? 'skills.sh request failed',
        );
      }
    },
  );

  server.get(
    '/skills/registry/curated',
    {
      schema: {
        response: {
          200: z.object({
            skills: z.array(registrySkillSchema.extend({ installed: z.boolean() })),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const items = await getCurated();
        const installed = await loadInstalledSourceIds(userId);
        return { skills: annotate(items, installed) };
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode ?? 502;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          (err as Error).message ?? 'skills.sh request failed',
        );
      }
    },
  );

  server.post(
    '/skills/registry/install',
    {
      schema: {
        body: z.object({ id: z.string().min(3).max(300) }),
        response: { 201: skillResponseSchema },
      },
    },
    async (request, reply) => {
      const userId = await getUserId(request.cookies.sessionId);
      if (!userId) return sendApiError(reply, 401, 'UNAUTHORIZED');
      try {
        const detail = await getSkillDetail(request.body.id);
        const skillMd = detail.files?.find((f) => /SKILL\.md$/i.test(f.path));
        if (!skillMd) {
          return sendApiError(
            reply,
            422,
            'VALIDATION_ERROR',
            'Skill has no SKILL.md snapshot yet',
          );
        }
        const parsed = parseSkillMd(skillMd.contents);
        const localSlug = buildLocalSlug(detail.source, detail.slug);
        const row = await service.create(userId, {
          slug: localSlug,
          name: parsed.name ?? detail.slug,
          description: parsed.description,
          bodyMarkdown: parsed.body,
          sourcePath: `skills.sh:${detail.id}`,
          triggers: [],
          enabled: true,
        });
        return reply.code(201).send(row);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode ?? 502;
        return sendApiError(
          reply,
          status,
          apiErrorCodeFromStatus(status),
          (err as Error).message ?? 'Failed to install registry skill',
        );
      }
    },
  );
}
