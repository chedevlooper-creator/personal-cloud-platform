# OpenAI SDK (Node) — services/agent/llm, embeddings

## Chat completions (basic)

```ts
import OpenAI from 'openai';
const client = new OpenAI();

const r = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  max_tokens: 200,
});
console.log(r.choices[0].message.content);
```

## Streaming (raw async iterator)

```ts
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Say hi' }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

## Stream helper (.stream())

```ts
const runner = client.chat.completions
  .stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] })
  .on('content', (delta) => process.stdout.write(delta))
  .on('chatCompletion', (c) => console.log('done', c.id));

const finalContent = await runner.finalContent();
```

## Tool calling + runTools (auto)

```ts
const runner = client.chat.completions
  .runTools({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'weather in LA this week?' }],
    tools: [{
      type: 'function',
      function: {
        name: 'getWeather',
        parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
        function: async ({ city }: { city: string }) => fetchWeather(city),
      },
    }],
  })
  .on('message', (m) => console.log(m));

const finalContent = await runner.finalContent();
```

## Abort within tool

```ts
function: function updateDb(_props, runner) { runner.abort(); }
```

## Embeddings (memory service)

```ts
const e = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: ['chunk1', 'chunk2'],
});
const vectors = e.data.map(d => d.embedding); // number[][]
```

## Events
- `connect`, `chunk`, `chatCompletion`, `message`, `content`, `functionCall`

## Proje notları
- Embedding boyutu `text-embedding-3-small`=1536, `-3-large`=3072 — Drizzle vector dimensions ile eşleştir.
- Streaming response'u Fastify SSE/WebSocket'a köprülemek için `.on('content')` kullan.
- Rate limit yönetimi BullMQ üzerinden batch + retry.
