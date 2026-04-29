# Fastify 4 — services/*

## onError hook (correlation log)

```ts
fastify.addHook('onError', async (request, reply, error) => {
  request.log.error({ err: error, userId: request.user?.id }, 'request failed');
});
```

## Async hook with throw

```ts
fastify.addHook('onRequest', async (request) => {
  if (!request.headers.authorization) throw new Error('no auth');
});
```

## attachValidation

```ts
fastify.post('/', { schema, attachValidation: true }, (req, reply) => {
  if (req.validationError) return reply.code(400).send(req.validationError);
});
```

## Custom error handler

```ts
fastify.setErrorHandler(function (error, request, reply) {
  request.log.error(error, `status=${error.statusCode}`);
  if (error.validation) {
    return reply.status(422).send({
      message: `validation failed for ${error.validationContext}`,
      errors: error.validation,
    });
  }
  reply.status(error.statusCode ?? 500).send({ error: error.message });
});
```

## Plugin error handling

```ts
fastify.register(require('./db-connector'));
fastify.after(err => { if (err) throw err; });
fastify.ready(err => { if (err) console.error(err); });
```

## onResponse hook (metrics)

```ts
fastify.addHook('onResponse', async (request, reply) => {
  await metrics.observe({ route: request.routerPath, ms: reply.elapsedTime });
});
```

## AJV options + ajv-errors

```ts
const fastify = Fastify({
  ajv: {
    customOptions: { allErrors: true },
    plugins: [require('ajv-errors')],
  },
});
```

## Stream reply error

```ts
fastify.setErrorHandler((err, _req, reply) => {
  reply.code(400).type('application/json').send({ error: err.message });
});
```

## Proje notları
- Tüm route'ları `fastify-type-provider-zod` ile yazın.
- Pino: `correlationId, userId, service` zorunlu — `request.id`'i correlationId olarak kullan.
- `setErrorHandler`'ı her servisin `index.ts`'inde standart bir hata zarfıyla register edin (architecture rule).
- Auth middleware için `onRequest` hook'unu paylaşılan plugin'e taşımak duplikasyonu azaltır.
