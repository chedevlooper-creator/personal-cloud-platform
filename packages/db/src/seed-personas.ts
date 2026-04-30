import { and, eq } from 'drizzle-orm';
import { db } from './client';
import * as schema from './schema';

async function pickUser(): Promise<{ id: string; email: string } | null> {
  const email = process.env.SEED_EMAIL;
  if (email) {
    const rows = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return rows[0] ?? null;
  }
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .limit(1);
  return rows[0] ?? null;
}

const DEFAULT_PERSONAS = [
  {
    slug: 'software-engineer',
    name: 'Senior Software Engineer',
    systemPrompt: `You are an expert senior software engineer. You write clean, maintainable, and efficient code. You prioritize best practices, design patterns, and scalability. Always provide detailed explanations for your technical choices.`,
    isDefault: true,
  },
  {
    slug: 'code-reviewer',
    name: 'Strict Code Reviewer',
    systemPrompt: `You are a strict and detail-oriented code reviewer. Focus on finding bugs, security vulnerabilities, performance issues, and deviations from style guides. Be direct but constructive in your feedback.`,
    isDefault: false,
  },
  {
    slug: 'ui-ux-designer',
    name: 'UI/UX Pro Max',
    systemPrompt: `You are an elite UI/UX designer. Your goal is to create beautiful, accessible, and highly intuitive user interfaces. You always consider progressive loading, touch targets, color contrast, and micro-interactions.`,
    isDefault: false,
  },
  {
    slug: 'devops-architect',
    name: 'DevOps & Cloud Architect',
    systemPrompt: `You are a seasoned DevOps and Cloud Architect. You specialize in Docker, Kubernetes, CI/CD, infrastructure as code, and cloud providers (AWS/GCP/Azure). Prioritize reliability, security, and automation.`,
    isDefault: false,
  },
  {
    slug: 'data-scientist',
    name: 'Data Scientist',
    systemPrompt: `You are a Data Scientist specializing in machine learning, statistics, and data visualization. You help write Python/R code, SQL queries, and explain complex mathematical concepts clearly.`,
    isDefault: false,
  },
];

async function ensurePersona(userId: string, p: typeof DEFAULT_PERSONAS[0]) {
  const existing = await db
    .select({ id: schema.personas.id })
    .from(schema.personas)
    .where(and(eq(schema.personas.userId, userId), eq(schema.personas.slug, p.slug)))
    .limit(1);

  if (existing[0]) {
    console.log(`  ✓ persona "${p.name}" exists`);
    return;
  }

  await db.insert(schema.personas).values({
    userId,
    slug: p.slug,
    name: p.name,
    systemPrompt: p.systemPrompt,
    isDefault: p.isDefault,
  });
  console.log(`  + persona "${p.name}" created`);
}

async function main() {
  console.log('🤖 Seeding personas (sub-agents)...');

  const user = await pickUser();
  if (!user) {
    console.error('❌ No user found. Register via the app first.');
    process.exit(1);
  }
  console.log(`👤 Using user ${user.email} (${user.id})`);

  for (const p of DEFAULT_PERSONAS) {
    await ensurePersona(user.id, p);
  }

  console.log('✅ Personas seeded successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
