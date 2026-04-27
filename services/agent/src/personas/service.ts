import { db } from '@pcp/db/src/client';
import { personas } from '@pcp/db/src/schema';
import { and, eq } from 'drizzle-orm';
import type { CreatePersonaDto, UpdatePersonaDto } from '@pcp/shared';

export class PersonasService {
  async list(userId: string) {
    return db.query.personas.findMany({
      where: eq(personas.userId, userId),
      orderBy: (p, { desc, asc }) => [desc(p.isDefault), asc(p.name)],
    });
  }

  async get(id: string, userId: string) {
    const row = await db.query.personas.findFirst({
      where: and(eq(personas.id, id), eq(personas.userId, userId)),
    });
    return row ?? null;
  }

  async getDefault(userId: string) {
    return db.query.personas.findFirst({
      where: and(eq(personas.userId, userId), eq(personas.isDefault, true)),
    });
  }

  async create(userId: string, dto: CreatePersonaDto) {
    const existing = await db.query.personas.findFirst({
      where: and(eq(personas.userId, userId), eq(personas.slug, dto.slug)),
    });
    if (existing) {
      throw Object.assign(new Error('Persona slug already exists'), { statusCode: 409 });
    }

    if (dto.isDefault) {
      await db
        .update(personas)
        .set({ isDefault: false })
        .where(eq(personas.userId, userId));
    }

    const [row] = await db
      .insert(personas)
      .values({
        userId,
        slug: dto.slug,
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        icon: dto.icon ?? null,
        isDefault: dto.isDefault ?? false,
      })
      .returning();
    if (!row) throw new Error('Failed to create persona');
    return row;
  }

  async update(id: string, userId: string, dto: UpdatePersonaDto) {
    const current = await this.get(id, userId);
    if (!current) throw Object.assign(new Error('Persona not found'), { statusCode: 404 });

    if (dto.isDefault) {
      await db
        .update(personas)
        .set({ isDefault: false })
        .where(eq(personas.userId, userId));
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.systemPrompt !== undefined) patch.systemPrompt = dto.systemPrompt;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;

    const [row] = await db
      .update(personas)
      .set(patch)
      .where(and(eq(personas.id, id), eq(personas.userId, userId)))
      .returning();
    if (!row) throw new Error('Failed to update persona');
    return row;
  }

  async remove(id: string, userId: string) {
    const current = await this.get(id, userId);
    if (!current) throw Object.assign(new Error('Persona not found'), { statusCode: 404 });
    await db
      .delete(personas)
      .where(and(eq(personas.id, id), eq(personas.userId, userId)));
    return { success: true };
  }
}
