import { db } from '@pcp/db/src/client';
import { skills } from '@pcp/db/src/schema';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import type { CreateSkillDto, UpdateSkillDto } from '@pcp/shared';

export class SkillsService {
  async list(userId: string) {
    return db.query.skills.findMany({
      where: and(eq(skills.userId, userId), isNull(skills.deletedAt)),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
  }

  async get(id: string, userId: string) {
    return db.query.skills.findFirst({
      where: and(eq(skills.id, id), eq(skills.userId, userId), isNull(skills.deletedAt)),
    });
  }

  async getMany(ids: string[], userId: string) {
    if (ids.length === 0) return [];
    return db.query.skills.findMany({
      where: and(
        inArray(skills.id, ids),
        eq(skills.userId, userId),
        eq(skills.enabled, true),
        isNull(skills.deletedAt),
      ),
    });
  }

  async create(userId: string, dto: CreateSkillDto) {
    const existing = await db.query.skills.findFirst({
      where: and(
        eq(skills.userId, userId),
        eq(skills.slug, dto.slug),
        isNull(skills.deletedAt),
      ),
    });
    if (existing) {
      throw Object.assign(new Error('Skill slug already exists'), { statusCode: 409 });
    }

    const [row] = await db
      .insert(skills)
      .values({
        userId,
        workspaceId: dto.workspaceId ?? null,
        slug: dto.slug,
        name: dto.name,
        description: dto.description ?? null,
        bodyMarkdown: dto.bodyMarkdown ?? null,
        sourcePath: dto.sourcePath ?? null,
        triggers: dto.triggers ?? [],
        enabled: dto.enabled ?? true,
      })
      .returning();
    if (!row) throw new Error('Failed to create skill');
    return row;
  }

  async update(id: string, userId: string, dto: UpdateSkillDto) {
    const current = await this.get(id, userId);
    if (!current) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.bodyMarkdown !== undefined) patch.bodyMarkdown = dto.bodyMarkdown;
    if (dto.triggers !== undefined) patch.triggers = dto.triggers;
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;

    const [row] = await db
      .update(skills)
      .set(patch)
      .where(and(eq(skills.id, id), eq(skills.userId, userId)))
      .returning();
    if (!row) throw new Error('Failed to update skill');
    return row;
  }

  async remove(id: string, userId: string) {
    const current = await this.get(id, userId);
    if (!current) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
    await db
      .update(skills)
      .set({ deletedAt: new Date() })
      .where(and(eq(skills.id, id), eq(skills.userId, userId)));
    return { success: true };
  }

  /**
   * Match enabled skills against a user input. Returns skills whose triggers
   * (case-insensitive substring match) appear in the input. Used to suggest
   * skills before a task starts.
   */
  async matchTriggers(userId: string, input: string) {
    const all = await db.query.skills.findMany({
      where: and(
        eq(skills.userId, userId),
        eq(skills.enabled, true),
        isNull(skills.deletedAt),
      ),
    });
    const lower = input.toLowerCase();
    return all.filter((s) =>
      (s.triggers ?? []).some((t) => t && lower.includes(t.toLowerCase())),
    );
  }
}
