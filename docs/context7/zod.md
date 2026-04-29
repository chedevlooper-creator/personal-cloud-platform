# Zod — packages/shared, services/* validation

## Temel parsing

```ts
import { z } from 'zod';

const Schema = z.string();
Schema.parse('ok');             // throws on error
Schema.safeParse(12);           // { success: false, error: ZodError }
```

## Async validation

```ts
const s = z.string().refine(async (v) => v.length <= 8);
await s.parseAsync('hello');           // 'hello'
await s.safeParseAsync('hello world'); // { success: false, ... }
```

## Refine (custom rule)

```ts
const password = z.string().refine(v => v.length >= 8, {
  message: 'Password must be at least 8 chars',
});
```

## superRefine (multiple issues)

```ts
const schema = z.string().superRefine((val, ctx) => {
  if (val.length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 5,
      type: 'string',
      inclusive: true,
      message: 'Must be 5 or more characters',
    });
  }
});
```

## Transform

```ts
const stringToLength = z.string().transform(v => v.length);
```

## Env validation pattern (önerilen)

```ts
// services/<svc>/src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  ENCRYPTION_KEY: z.string().length(64), // hex 32 bytes
});

export const env = EnvSchema.parse(process.env);
```

## Proje notları
- Tüm DTO'lar `packages/shared/src/*.ts` altında — frontend ve backend ortak.
- Fastify route schemalarında `fastify-type-provider-zod` kullan.
- `process.env` fallback'lerini kademeli olarak yukarıdaki env pattern'ına taşı.
